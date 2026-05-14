"""
Dicoding Coding Camp Scraper Service
Adapted from diCodex/main.py to work with Docker Selenium container.
Pure scraping logic — job management is handled by ARQ.
"""
import html
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Callable, Optional

from selenium import webdriver
from selenium.common.exceptions import (
    InvalidSessionIdException,
    NoSuchElementException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as ec
from selenium.webdriver.support.ui import WebDriverWait
from dotenv import load_dotenv

# Load environment variables from root directory
# In Docker, env vars are injected directly, so this is mainly for local dev
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent.parent / ".env")

# Configuration
CODINGCAMP_URL = os.getenv("CODINGCAMP_URL", "https://codingcamp.dicoding.com")
SELENIUM_URL = os.getenv("SELENIUM_URL", "http://selenium:4444")
OUTPUT_DIR = Path("/app/output")
MAX_PAGINATION_STEPS = 300
INTERACTION_TIMEOUT_SECONDS = 20
ASYNC_SCRIPT_TIMEOUT_SECONDS = 240
FAST_PAGINATION_DELAY_MS = 120


class InvalidCredentialsError(Exception):
    """Raised when login credentials are rejected by the site."""
    pass


class ScraperService:
    """
    Scrapes Dicoding Coding Camp student data via Selenium.

    This class is stateless — each call to run_scraper() creates its own
    Selenium session. Job lifecycle is managed by ARQ.
    """

    def run_scraper(
        self,
        email: str | None = None,
        password: str | None = None,
        on_progress: callable = None,
        progress_callback: Optional[Callable[[str, int, int], None]] = None,
    ) -> Dict[str, Any]:
        """
        Run the scraping process.

        Args:
            email: Dicoding email (optional, falls back to env var)
            email: Dicoding email (optional, falls back to env var)
            password: Dicoding password (optional, falls back to env var)
            progress_callback: Optional function (message, current_step, total_steps)

        Returns:
            Dict with success status, filename, and student count.
        """
        scraper_email = email or os.getenv("DICODING_EMAIL", "")
        scraper_password = password or os.getenv("DICODING_PASSWORD", "")

        if not scraper_email or not scraper_password:
            raise ValueError("Email and password are required")

        driver = self._build_driver()

        try:
            if progress_callback:
                progress_callback("Initializing scraper...", 1, 100)

            # Navigate and login
            if progress_callback:
                progress_callback("Navigating to login page...", 5, 100)

            driver.get(CODINGCAMP_URL)
            wait = WebDriverWait(driver, 30)
            self._wait_for_page_ready(driver, wait)
            self._click_password_link(driver, wait)

            if progress_callback:
                progress_callback("Logging in...", 10, 100)
            self._login_with_email_password(driver, wait, scraper_email, scraper_password)

            # Wait for redirect after login, detecting invalid credentials
            try:
                WebDriverWait(driver, 30).until(
                    lambda d: self._check_login_result(d)
                )
            except InvalidCredentialsError:
                raise
            except (TimeoutException, InvalidSessionIdException, WebDriverException) as exc:
                raise InvalidCredentialsError(
                    "Login failed. The email or password may be incorrect."
                ) from exc

            self._wait_for_page_ready(driver, wait)

            # Extract mentor info immediately for notification
            mentor_info = self._extract_mentor_from_dom(driver)
            if on_progress:
                on_progress("started", mentor_info)
            if progress_callback:
                progress_callback("Expanding student list...", 15, 100)

            # Expand all student data
            self._expand_all_student_data(driver)
            self._wait_until(
                lambda: len(driver.find_elements(By.CSS_SELECTOR, "section.daily-checkins")) > 0,
                timeout=8,
            )

            if progress_callback:
                progress_callback("Extracting student data...", 20, 100)

            # Extract and save data
            payload = self._build_export_json(driver, progress_callback)

            # Save to file
            group_name = self._sanitize_filename_part(
                payload["mentor"].get("group", "unknown_group")
            )
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            out_path = OUTPUT_DIR / f"{group_name}_{timestamp}.json"
            out_path.write_text(
                json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
            )

            if progress_callback:
                progress_callback("Finalizing...", 100, 100)

            return {
                "success": True,
                "file": str(out_path.name),
                "students": payload["metadata"]["student_total"],
                "mentor": payload["mentor"],
            }

        finally:
            driver.quit()

    def _build_driver(self) -> webdriver.Remote:
        """Build Selenium Remote WebDriver for Docker container"""
        options = webdriver.ChromeOptions()
        options.page_load_strategy = "eager"
        options.add_experimental_option(
            "prefs",
            {
                "profile.managed_default_content_settings.images": 2,
            },
        )
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--headless=new")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-background-networking")
        options.add_argument("--disable-software-rasterizer")
        options.add_argument("--window-size=1280,720")

        driver = webdriver.Remote(
            command_executor=SELENIUM_URL,
            options=options,
        )
        driver.set_script_timeout(ASYNC_SCRIPT_TIMEOUT_SECONDS)

        return driver

    # ── Helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _normalize_space(text: str) -> str:
        return re.sub(r"\s+", " ", (text or "")).strip()

    @staticmethod
    def _sanitize_filename_part(text: str) -> str:
        cleaned = re.sub(r"[^\w\-]+", "_", (text or "").strip(), flags=re.ASCII)
        cleaned = cleaned.strip("_")
        return cleaned or "unknown_group"

    @staticmethod
    def _one(pattern: str, text: str) -> str:
        match = re.search(pattern, text, flags=re.S)
        if not match:
            return ""
        return ScraperService._normalize_space(html.unescape(match.group(1)))

    @staticmethod
    def _many(pattern: str, text: str) -> list:
        rows = []
        for match in re.findall(pattern, text, flags=re.S):
            if isinstance(match, str):
                rows.append((ScraperService._normalize_space(html.unescape(match)),))
            else:
                rows.append(
                    tuple(
                        ScraperService._normalize_space(html.unescape(item))
                        for item in match
                    )
                )
        return rows

    @staticmethod
    def _html_fragment_to_text(fragment: str) -> str:
        no_tags = re.sub(r"<[^>]+>", " ", fragment or "", flags=re.S)
        return ScraperService._normalize_space(html.unescape(no_tags))

    @staticmethod
    def _labeled_value(block_html: str, label: str) -> str:
        escaped_label = re.escape(label)
        patterns = [
            (
                rf"<p[^>]*>\s*{escaped_label}\s*</p>\s*</div>\s*"
                r'<p[^>]*class="[^"]*pl-4[^"]*"[^>]*>(.*?)</p>'
            ),
            (
                rf"<p[^>]*>\s*{escaped_label}\s*</p>\s*</div>\s*"
                r'<ul[^>]*class="[^"]*pl-4[^"]*"[^>]*>\s*'
                r"<li[^>]*>(.*?)</li>"
            ),
            (
                rf"<p[^>]*>\s*{escaped_label}\s*</p>.*?"
                r"<p[^>]*>(.*?)</p>"
            ),
        ]
        for pattern in patterns:
            match = re.search(pattern, block_html, flags=re.S)
            if not match:
                continue
            return ScraperService._html_fragment_to_text(match.group(1))
        return ""

    @staticmethod
    def _student_blocks(page_html: str) -> list:
        marker = '<div class="container flex flex-col pb-8 border-b">'
        parts = page_html.split(marker)[1:]
        blocks = []
        for idx, part in enumerate(parts):
            if idx < len(parts) - 1:
                part = part.split(marker)[0]
            blocks.append(part)
        return blocks

    @staticmethod
    def _find_first_visible(driver, locators):
        for by, value in locators:
            for element in driver.find_elements(by, value):
                if element.is_displayed():
                    return element
        return None

    @staticmethod
    def _wait_for_page_ready(driver, wait):
        wait.until(lambda d: d.execute_script("return document.readyState") == "complete")
        wait.until(ec.presence_of_element_located((By.CSS_SELECTOR, "body")))

    @staticmethod
    def _click_element(driver, element):
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        try:
            element.click()
        except Exception:
            driver.execute_script("arguments[0].click();", element)

    def _click_password_link(self, driver, wait):
        locators = [
            (By.LINK_TEXT, "your password"),
            (By.XPATH, "//a[normalize-space()='your password']"),
            (By.XPATH, "//a[contains(normalize-space(.), 'your password')]"),
        ]

        for locator in locators:
            try:
                element = wait.until(ec.element_to_be_clickable(locator))
                self._click_element(driver, element)
                return
            except TimeoutException:
                continue

        raise NoSuchElementException("Link 'your password' not found")

    @staticmethod
    def _check_login_error(driver) -> str | None:
        """Check the page for login error messages. Returns the error text if found, None otherwise."""
        error_selectors = [
            "[role='alert']",
            ".alert-danger",
            ".error-message",
            ".toast-error",
            "[data-testid='error']",
        ]
        for selector in error_selectors:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
            for el in elements:
                if el.is_displayed() and el.text.strip():
                    return el.text.strip()

        error_keywords = ["invalid", "incorrect", "wrong", "salah", "gagal", "failed"]
        try:
            page_text = driver.find_element(By.TAG_NAME, "body").text.lower()
            for keyword in error_keywords:
                if keyword in page_text and "/login" in driver.current_url:
                    return f"Login page shows an error (detected keyword: '{keyword}')"
        except Exception:
            pass

        return None

    def _check_login_result(self, driver) -> bool:
        """
        Condition for WebDriverWait: returns True when login succeeded (redirected away from /login).
        Raises InvalidCredentialsError early if an error message is detected on the page.
        """
        if "/login" not in driver.current_url:
            return True

        error_msg = self._check_login_error(driver)
        if error_msg:
            raise InvalidCredentialsError(
                f"Login failed — the site returned an error: {error_msg}"
            )

        return False

    def _login_with_email_password(self, driver, wait, email: str, password: str):
        wait.until(
            ec.visibility_of_element_located((By.CSS_SELECTOR, "input[type='password']"))
        )

        if not email or not password:
            raise ValueError("EMAIL/PASSWORD empty. Credentials must be provided.")

        email_input = self._find_first_visible(
            driver,
            [
                (By.CSS_SELECTOR, "input[type='email']"),
                (By.NAME, "email"),
                (By.ID, "email"),
            ],
        )
        password_input = self._find_first_visible(
            driver,
            [
                (By.CSS_SELECTOR, "input[type='password']"),
                (By.NAME, "password"),
                (By.ID, "password"),
            ],
        )
        submit_button = self._find_first_visible(
            driver,
            [
                (By.CSS_SELECTOR, "button[type='submit']"),
                (By.CSS_SELECTOR, "input[type='submit']"),
                (
                    By.XPATH,
                    "//button[contains(., 'Sign in') or contains(., 'Login') or contains(., 'Masuk')]",
                ),
            ],
        )

        if not email_input or not password_input or not submit_button:
            raise NoSuchElementException("Login form components not found")

        email_input.clear()
        email_input.send_keys(email)
        password_input.clear()
        password_input.send_keys(password)
        self._click_element(driver, submit_button)

    def _expand_all_student_data(self, driver):
        """Expand all student data sections"""
        text_normalizer = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        text_lower = "abcdefghijklmnopqrstuvwxyz"

        student_input_locators = [
            (
                By.XPATH,
                f"//input[contains(translate(@placeholder, '{text_normalizer}', '{text_lower}'), 'student') "
                f"and contains(translate(@placeholder, '{text_normalizer}', '{text_lower}'), 'id')]",
            ),
            (
                By.XPATH,
                f"//input[contains(translate(@aria-label, '{text_normalizer}', '{text_lower}'), 'student') "
                f"and contains(translate(@aria-label, '{text_normalizer}', '{text_lower}'), 'id')]",
            ),
            (
                By.XPATH,
                f"//div[contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), \"student's name or id\")]",
            ),
        ]
        select_all_locators = [
            (
                By.XPATH,
                f"//button[contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), 'select all')]",
            ),
            (
                By.XPATH,
                f"//label[contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), 'select all')]",
            ),
            (
                By.XPATH,
                f"//span[contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), 'select all')]",
            ),
        ]
        expand_all_locators = [
            (
                By.XPATH,
                f"//button[contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), 'expand all')]",
            ),
            (
                By.XPATH,
                f"//span[contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), 'expand all')]",
            ),
            (
                By.XPATH,
                f"//*[@role='button' and contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), 'expand all')]",
            ),
        ]

        self._click_from_locators(driver, student_input_locators, "Input student's name or ID")
        self._wait_for_any_locator(driver, select_all_locators, timeout=5)
        self._click_from_locators(driver, select_all_locators, "Select All")
        self._wait_for_any_locator(driver, expand_all_locators, timeout=5)
        self._click_from_locators(driver, expand_all_locators, "Expand All")
        self._wait_until(
            lambda: len(driver.find_elements(By.CSS_SELECTOR, "section.point-histories")) > 0,
            timeout=8,
        )

    def _click_from_locators(self, driver, locators, action_label):
        deadline = time.time() + INTERACTION_TIMEOUT_SECONDS
        last_error = None

        while time.time() < deadline:
            for by, value in locators:
                element = self._find_first_visible(driver, [(by, value)])
                if not element:
                    continue
                try:
                    self._click_element(driver, element)
                    return
                except Exception as error:
                    last_error = error
            time.sleep(0.1)

        message = f"Failed to click '{action_label}'"
        if last_error:
            raise NoSuchElementException(f"{message}. Detail: {last_error}") from last_error
        raise NoSuchElementException(message)

    def _build_export_json(
        self,
        driver,
        progress_callback: Optional[Callable[[str, int, int], None]] = None,
    ) -> dict:
        """Build the JSON export from scraped data"""
        mentor = self._extract_mentor_from_dom(driver)

        # Click show all buttons
        self._click_all_buttons_by_keyword(driver, "show all attendances")
        show_all_courses_clicked = self._click_all_buttons_by_keyword(driver, "show all courses")
        show_all_assignments_clicked = self._click_all_buttons_by_keyword(
            driver, "show all assignments"
        )
        show_all_attendances_clicked = self._click_all_buttons_by_keyword(
            driver, "show all attend"
        )

        source = driver.page_source
        blocks = self._student_blocks(source)

        if not blocks:
            raise NoSuchElementException("No student blocks found")

        students = [self._parse_student(block) for block in blocks]
        total_students = len(students)
        fast_attendance_by_student: list[dict] | None = None
        fast_daily_by_student: list[list[dict]] | None = None
        fast_point_by_student: list[dict] | None = None

        try:
            fast_attendance_by_student = self._extract_attendances_all_students_fast(
                driver
            )
        except Exception:
            fast_attendance_by_student = None

        if progress_callback:
            progress_callback("Collecting daily check-ins in bulk...", 25, 100)
        try:
            fast_daily_by_student = self._extract_daily_checkins_all_students_fast(driver)
        except Exception:
            fast_daily_by_student = None

        if progress_callback:
            progress_callback("Collecting point histories in bulk...", 30, 100)
        try:
            fast_point_by_student = self._extract_point_histories_all_students_fast(driver)
        except Exception:
            fast_point_by_student = None

        if (
            fast_daily_by_student is None
            or not isinstance(fast_daily_by_student, list)
            or len(fast_daily_by_student) != total_students
            or any(not isinstance(items, list) for items in fast_daily_by_student)
        ):
            fast_daily_by_student = None

        if (
            fast_point_by_student is None
            or not isinstance(fast_point_by_student, list)
            or len(fast_point_by_student) != total_students
            or any(not isinstance(items, dict) for items in fast_point_by_student)
        ):
            fast_point_by_student = None

        if (
            fast_attendance_by_student is None
            or not isinstance(fast_attendance_by_student, list)
            or len(fast_attendance_by_student) != total_students
            or any(
                not isinstance(items, dict)
                for items in fast_attendance_by_student
            )
            or any(
                not isinstance(items.get("items", []), list)
                for items in fast_attendance_by_student
            )
        ):
            fast_attendance_by_student = None

        # Extract additional data for each student
        for idx in range(total_students):
            if progress_callback:
                # Map student processing to 35% - 95% range.
                if total_students <= 1:
                    percent = 95
                else:
                    percent = 35 + int((idx / (total_students - 1)) * 60)
                student_name = students[idx]["profile"]["name"]
                progress_callback(
                    f"Processing student {idx + 1}/{total_students}: {student_name}",
                    percent,
                    100,
                )

            if fast_attendance_by_student and idx < len(fast_attendance_by_student):
                students[idx]["progress"]["attendances"] = (
                    fast_attendance_by_student[idx]
                )

            if fast_daily_by_student and idx < len(fast_daily_by_student):
                students[idx]["progress"]["daily_checkins"] = {
                    "items": fast_daily_by_student[idx]
                }
            else:
                students[idx]["progress"]["daily_checkins"] = {
                    "items": self._extract_daily_checkins_all_pages(driver, idx)
                }

            if fast_point_by_student and idx < len(fast_point_by_student):
                students[idx]["progress"]["point_histories"] = fast_point_by_student[idx]
            else:
                students[idx]["progress"]["point_histories"] = (
                    self._extract_point_histories_all_pages(driver, idx)
                )

        return {
            "metadata": {
                "generated_at_utc": datetime.now(timezone.utc).isoformat(),
                "source_url": driver.current_url,
                "student_total": len(students),
                "show_all_courses_clicked": show_all_courses_clicked,
                "show_all_assignments_clicked": show_all_assignments_clicked,
                "show_all_attendances_clicked": show_all_attendances_clicked,
            },
            "mentor": mentor,
            "students": students,
        }

    def _extract_mentor_from_dom(self, driver) -> dict:
        """Extract mentor information from DOM"""
        data = driver.execute_script(
            r"""
            const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
            const allText = Array.from(document.querySelectorAll("body *"))
              .map((el) => text(el))
              .filter(Boolean);
            const groupPattern = /^(CAC|CDC|CFC)-\d+$/i;
            const codePattern = /^facil-[a-z]+-\d+$/i;
            const nav = Array.from(document.querySelectorAll("a.nav-link"))
              .map((el) => text(el))
              .filter(Boolean);

            const codeElement = Array.from(document.querySelectorAll(".text-id.uppercase, .text-id"))
              .find((el) => codePattern.test(text(el)));
            const mentorCard = codeElement?.closest(".card");
            const cardText = mentorCard
              ? Array.from(mentorCard.querySelectorAll("*"))
                .map((el) => text(el))
                .filter(Boolean)
              : [];
            const oldName = text(document.querySelector(".sidebar-menu .text-xl"));
            const newName = text(mentorCard?.querySelector("span.text-xl"))
              || Array.from(document.querySelectorAll(".card span.text-xl"))
                .map((el) => text(el))
                .find((value) => value && !groupPattern.test(value) && !codePattern.test(value))
              || "";
            const mentorCode = text(document.querySelector(".sidebar-menu .text-id.uppercase"))
              || text(codeElement)
              || allText.find((value) => codePattern.test(value))
              || "";
            const oldGroup = text(document.querySelector("li .font-normal.text-black.pt-1.pl-5"));
            const newGroup = cardText.find((value) => groupPattern.test(value))
              || allText.find((value) => groupPattern.test(value))
              || "";
            const codeGroup = (mentorCode.match(/^facil-([a-z]+)-(\d+)$/i) || [])
              .slice(1)
              .join("-")
              .toUpperCase();

            return {
              name: oldName || newName,
              mentor_code: mentorCode,
              group: oldGroup || newGroup || codeGroup,
              nav_items: nav
            };
            """
        )
        return {
            "group": data.get("group", ""),
            "mentor_code": data.get("mentor_code", ""),
            "name": data.get("name", ""),
            "nav_items": data.get("nav_items", []),
        }

    def _click_all_buttons_by_keyword(self, driver, keyword: str, max_clicks: int = 500) -> int:
        """Click all buttons containing a keyword"""
        keyword = keyword.lower()
        payload = driver.execute_async_script(
            """
            const keyword = arguments[0];
            const maxClicks = arguments[1];
            const done = arguments[arguments.length - 1];
            const text = (el) => (el?.textContent || "").replace(/\\s+/g, " ").trim().toLowerCase();
            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

            (async () => {
              let clicked = 0;
              for (let round = 0; round < 30; round += 1) {
                const buttons = Array.from(document.querySelectorAll("button"))
                  .filter((el) => {
                    const visible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
                    const disabled = el.hasAttribute("disabled");
                    return visible && !disabled && text(el).includes(keyword);
                  });

                if (buttons.length === 0 || clicked >= maxClicks) {
                  break;
                }

                for (const button of buttons) {
                  if (clicked >= maxClicks) {
                    break;
                  }
                  button.click();
                  clicked += 1;
                }

                await sleep(60);
              }

              done({ ok: true, clicked });
            })().catch((error) => done({ ok: false, error: String(error) }));
            """,
            keyword,
            max_clicks,
        )
        if not payload or not payload.get("ok"):
            clicked = 0
            xpath = (
                "//button[contains("
                "translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "
                f"'{keyword}'"
                ")]"
            )
            while clicked < max_clicks:
                buttons = driver.find_elements(By.XPATH, xpath)
                target = None
                for button in buttons:
                    if button.is_displayed():
                        target = button
                        break
                if not target:
                    break
                self._click_element(driver, target)
                clicked += 1
                time.sleep(0.05)
            return clicked
        return int(payload.get("clicked", 0))

    def _extract_daily_checkins_all_students_fast(self, driver) -> list[list[dict]]:
        """Extract daily check-ins for all students with one async browser script."""
        payload = driver.execute_async_script(
            r"""
            const delayMs = Number(arguments[0] || 80);
            const done = arguments[arguments.length - 1];
            const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const maxSteps = 300;

            const readEntries = (section) => {
              const cards = Array.from(section.querySelectorAll("div.border-b.p-6"));
              return cards.map((card) => {
                const mood = text(card.querySelector("p.text-lg"));
                const date = text(card.querySelector("p.text-sm.text-gray-500"));

                const reflectionHeading = Array.from(card.querySelectorAll("p.text-md.font-semibold"))
                  .find((el) => /reflection/i.test(text(el)));
                let reflection = "";
                if (reflectionHeading) {
                  reflection = text(reflectionHeading.parentElement?.querySelector("p.text-sm.text-gray-700"));
                }

                const goalsHeading = Array.from(card.querySelectorAll("p.text-md.font-semibold"))
                  .find((el) => /goals/i.test(text(el)));
                let goals = [];
                if (goalsHeading) {
                  const goalsRoot = goalsHeading.parentElement;
                  const groups = Array.from(goalsRoot.querySelectorAll("div.mb-3, div.last\\:mb-0"));
                  if (groups.length === 0) {
                    const fallbackItems = Array.from(goalsRoot.querySelectorAll("li")).map((el) => text(el)).filter(Boolean);
                    if (fallbackItems.length > 0) {
                      goals.push({ title: "", items: fallbackItems });
                    }
                  } else {
                    goals = groups.map((group) => ({
                      title: text(group.querySelector("p.text-sm.font-semibold")),
                      items: Array.from(group.querySelectorAll("li")).map((el) => text(el)).filter(Boolean),
                    }));
                  }
                }

                return { mood, date, reflection, goals };
              });
            };

            const nextButton = (section) => {
              const buttons = Array.from(section.querySelectorAll("button"));
              return (
                buttons.find((btn) => /^next$/i.test(text(btn))) ||
                buttons.find((btn) => /next/i.test(text(btn))) ||
                null
              );
            };

            const isDisabled = (button) => {
              if (!button) {
                return true;
              }
              const disabledAttr = button.hasAttribute("disabled");
              const ariaDisabled = (button.getAttribute("aria-disabled") || "").toLowerCase().trim();
              return disabledAttr || ariaDisabled === "true" || !button.isConnected;
            };

            const keyForEntry = (entry) =>
              JSON.stringify({
                mood: entry.mood || "",
                date: entry.date || "",
                reflection: entry.reflection || "",
                goals: entry.goals || [],
              });

            (async () => {
              const sections = Array.from(document.querySelectorAll("section.daily-checkins"));
              const allItems = [];

              for (const section of sections) {
                const items = [];
                const seen = new Set();
                let staleRounds = 0;

                for (let step = 0; step < maxSteps; step += 1) {
                  const entries = readEntries(section);
                  const before = seen.size;

                  for (const entry of entries) {
                    const key = keyForEntry(entry);
                    if (seen.has(key)) {
                      continue;
                    }
                    seen.add(key);
                    items.push(JSON.parse(key));
                  }

                  staleRounds = seen.size === before ? staleRounds + 1 : 0;
                  const next = nextButton(section);
                  if (!next || isDisabled(next) || staleRounds >= 2) {
                    break;
                  }

                  next.click();
                  await sleep(delayMs);
                }

                allItems.push(items);
              }

              done({ ok: true, items: allItems });
            })().catch((error) => done({ ok: false, error: String(error) }));
            """,
            FAST_PAGINATION_DELAY_MS,
        )

        if not payload or not payload.get("ok"):
            message = payload.get("error") if isinstance(payload, dict) else payload
            raise RuntimeError(f"Fast extraction daily-checkins failed: {message}")
        return payload.get("items", [])

    def _extract_point_histories_all_students_fast(self, driver) -> list[dict]:
        """Extract point histories for all students with one async browser script."""
        payload = driver.execute_async_script(
            r"""
            const delayMs = Number(arguments[0] || 80);
            const done = arguments[arguments.length - 1];
            const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const maxSteps = 300;

            const nextButton = (section) => {
              const buttons = Array.from(section.querySelectorAll("button"));
              return (
                buttons.find((btn) => /^next$/i.test(text(btn))) ||
                buttons.find((btn) => /next/i.test(text(btn))) ||
                null
              );
            };

            const isDisabled = (button) => {
              if (!button) {
                return true;
              }
              const disabledAttr = button.hasAttribute("disabled");
              const ariaDisabled = (button.getAttribute("aria-disabled") || "").toLowerCase().trim();
              return disabledAttr || ariaDisabled === "true" || !button.isConnected;
            };

            (async () => {
              const sections = Array.from(document.querySelectorAll("section.point-histories"));
              const allItems = [];

              for (const section of sections) {
                let lastUpdated = "";
                let totalPoint = "";
                let fallbackText = "";
                const items = [];
                const seen = new Set();
                let staleRounds = 0;

                for (let step = 0; step < maxSteps; step += 1) {
                  const lastUpdatedRaw = text(section.querySelector("[data-element='point-histories-last-update']"));
                  if (lastUpdatedRaw) {
                    lastUpdated = lastUpdatedRaw.replace(/^Last updated:\s*/i, "");
                  }

                  const totalBlock = Array.from(
                    section.querySelectorAll("div.flex.justify-between.items-center.border-b.p-6")
                  ).find((el) => /total point/i.test(text(el)));
                  if (totalBlock) {
                    totalPoint = text(totalBlock.querySelector("p.text-lg, p.text-xl"));
                  }

                  const noneText = text(section.querySelector("[data-element='point-histories-none']"));
                  if (noneText) {
                    fallbackText = noneText;
                  }

                  const rows = Array.from(section.querySelectorAll("div.space-y-0 > div"))
                    .map((row) => {
                      const values = Array.from(row.querySelectorAll("p,span")).map((el) => text(el)).filter(Boolean);
                      const rawText = text(row);
                      return { values, raw_text: rawText };
                    })
                    .filter((row) => row.raw_text && !/you have no point histories data/i.test(row.raw_text));

                  const before = seen.size;
                  for (const row of rows) {
                    const key = JSON.stringify({
                      raw_text: row.raw_text || "",
                      values: row.values || [],
                    });
                    if (seen.has(key)) {
                      continue;
                    }
                    seen.add(key);
                    items.push(JSON.parse(key));
                  }

                  staleRounds = seen.size === before ? staleRounds + 1 : 0;
                  const next = nextButton(section);
                  if (!next || isDisabled(next) || staleRounds >= 2) {
                    break;
                  }

                  next.click();
                  await sleep(delayMs);
                }

                allItems.push({
                  last_updated: lastUpdated,
                  total_point: totalPoint,
                  items,
                  fallback_text_if_empty: fallbackText,
                });
              }

              done({ ok: true, items: allItems });
            })().catch((error) => done({ ok: false, error: String(error) }));
            """,
            FAST_PAGINATION_DELAY_MS,
        )

        if not payload or not payload.get("ok"):
            message = payload.get("error") if isinstance(payload, dict) else payload
            raise RuntimeError(f"Fast extraction point-histories failed: {message}")
        return payload.get("items", [])

    def _wait_for_any_locator(self, driver, locators, timeout: float = 5.0) -> bool:
        """Wait until any locator in list becomes visible."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            element = self._find_first_visible(driver, locators)
            if element is not None:
                return True
            time.sleep(0.08)
        return False

    def _wait_until(self, condition: Callable[[], bool], timeout: float = 5.0) -> bool:
        """Wait until condition is true."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                if condition():
                    return True
            except Exception:
                pass
            time.sleep(0.08)
        return False

    def _section_signature(self, driver, selector: str, section_index: int) -> str:
        """Return a compact signature for section content to detect page changes."""
        return driver.execute_script(
            r"""
            const selector = arguments[0];
            const index = arguments[1];
            const sections = document.querySelectorAll(selector);
            if (!sections || sections.length <= index) return "";
            const section = sections[index];
            const text = (section.textContent || "").replace(/\s+/g, " ").trim();
            return text.slice(0, 4000);
            """,
            selector,
            section_index,
        ) or ""

    def _wait_for_section_change(
        self,
        driver,
        selector: str,
        section_index: int,
        previous_signature: str,
        timeout: float = 4.0,
    ) -> bool:
        """Wait until section content changes after pagination click."""
        return self._wait_until(
            lambda: (
                (current := self._section_signature(driver, selector, section_index))
                and current != previous_signature
            ),
            timeout=timeout,
        )

    def _parse_student(self, block_html: str) -> dict:
        """Parse student data from HTML block"""
        profile = {
            "name": self._one(r'<h3 class="text-3xl font-semibold">([^<]+)</h3>', block_html),
            "profile_link": self._one(r'<h1><a href="([^"]+)"', block_html),
            "photo_url": self._one(
                r'<img alt="[^"]+" src="([^"]+firebasestorage[^"]+)"', block_html
            ),
            "status_badge": self._one(
                r'<div class="inline-block text-xs font-medium[^>]*><p>([^<]+)</p></div>',
                block_html,
            ),
            "university": self._labeled_value(block_html, "University"),
            "major": self._labeled_value(block_html, "Major"),
            "facilitator": self._labeled_value(block_html, "Facilitator"),
            "lecturer": self._labeled_value(block_html, "Lecturer"),
        }

        # Extract attendances
        attendance_section = self._one(
            r'<section class="attendances w-full">(.*?)</section>', block_html
        )
        attendances = [
            {"event": event, "status": status}
            for event, status in self._many(
                r'data-event-name="([^"]+)".*?data-element="item-status-label">([^<]+)<',
                attendance_section,
            )
        ]
        attendance_last_updated = self._one(
            r'data-element="attendance-last-update">Last updated: ([^<]+)<',
            attendance_section,
        )
        attendance_fallback = self._one(
            r'data-element="attendance-none">\s*([^<]+)\s*<', attendance_section
        )

        # Extract courses
        course_section = self._one(
            r'(data-element="course-progress-title".*?</div></div></div></section>)',
            block_html,
        )
        courses = [
            {
                "course": course,
                "progress_percent": percent,
                "status": status,
            }
            for course, percent, status in self._many(
                r'data-course="([^"]+)".*?<span[^>]*class="mr-2">([^<]+)</span><span[^>]*data-element="item-status-label">([^<]+)</span>',
                course_section,
            )
        ]
        course_last_updated = self._one(
            r'data-element="course-progress-last-update">Last updated: ([^<]+)<',
            course_section,
        )

        # Extract assignments
        assignment_section = self._one(
            r'<section class="assignments w-full">(.*?)</section>', block_html
        )
        assignments = [
            {"assignment": name, "status": status}
            for name, status in self._many(
                r'data-assign-name="([^"]+)".*?data-element="item-status-label">([^<]+)<',
                assignment_section,
            )
        ]
        assignment_last_updated = self._one(
            r'data-element="assignment-last-update">Last updated: ([^<]+)<',
            assignment_section,
        )
        assignment_fallback = self._one(
            r'data-element="assignment-none">\s*([^<]+)\s*<', assignment_section
        )

        # Extract daily check-ins (initial parse, full pagination done later)
        daily_section = self._one(
            r'<section class="daily-checkins w-full">(.*?)</section>', block_html
        )
        daily_checkins = [
            {
                "mood": mood,
                "date": date,
                "reflection": reflection,
            }
            for mood, date, reflection in self._many(
                r'alt="([A-Za-z]+) mood".*?<p class="text-sm text-gray-500">([^<]+)</p>.*?<p class="text-sm text-gray-700">([^<]*)</p>',
                daily_section,
            )
        ]

        return {
            "profile": profile,
            "progress": {
                "attendances": {
                    "last_updated": attendance_last_updated,
                    "items": attendances,
                    "fallback_text_if_empty": attendance_fallback,
                },
                "course_progress": {
                    "last_updated": course_last_updated,
                    "items": courses,
                },
                "assignments": {
                    "last_updated": assignment_last_updated,
                    "items": assignments,
                    "fallback_text_if_empty": assignment_fallback,
                },
                "daily_checkins": {
                    "items": daily_checkins,
                },
            },
        }

    def _extract_attendances_all_students_fast(self, driver) -> list[dict]:
        """Extract attendance section for all students in one browser call."""
        payload = driver.execute_script(
            r"""
            const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
            const cards = Array.from(
              document.querySelectorAll("div.container.flex.flex-col.pb-8.border-b")
            );

            return cards.map((card) => {
              const section =
                card.querySelector("section.attendances") ||
                card.querySelector("section.attendance");
              const scope = section || card;
              const lastUpdatedRaw = text(
                scope.querySelector("[data-element='attendance-last-update']")
              );
              const fallbackText =
                text(scope.querySelector("[data-element='attendance-none']")) ||
                text(scope.querySelector("p.text-sm.text-gray-700"));

              const seen = new Set();
              const items = [];
              for (const row of Array.from(scope.querySelectorAll("[data-event-name]"))) {
                const event = (row.getAttribute("data-event-name") || "").trim();
                const status = text(
                  row.querySelector("[data-element='item-status-label']")
                );
                const key = `${event}||${status}`;
                if (seen.has(key)) {
                  continue;
                }
                seen.add(key);
                items.push({ event, status });
              }

              return {
                last_updated: lastUpdatedRaw.replace(/^Last updated:\s*/i, ""),
                fallback_text_if_empty: fallbackText,
                items,
              };
            });
            """
        )
        if not isinstance(payload, list):
            raise RuntimeError("Fast extraction attendances failed: invalid payload")

        normalized_payload = []
        for section in payload:
            if not isinstance(section, dict):
                normalized_payload.append(
                    {
                        "last_updated": "",
                        "items": [],
                        "fallback_text_if_empty": "",
                    }
                )
                continue

            rows = section.get("items", [])
            normalized_rows = []
            if isinstance(rows, list):
                for row in rows:
                    if not isinstance(row, dict):
                        continue
                    normalized_rows.append(
                        {
                            "event": self._normalize_space(str(row.get("event", ""))),
                            "status": self._normalize_space(str(row.get("status", ""))),
                        }
                    )

            normalized_payload.append(
                {
                    "last_updated": self._normalize_space(
                        str(section.get("last_updated", ""))
                    ),
                    "items": normalized_rows,
                    "fallback_text_if_empty": self._normalize_space(
                        str(section.get("fallback_text_if_empty", ""))
                    ),
                }
            )

        return normalized_payload

    def _extract_daily_checkins_all_pages(self, driver, student_index: int) -> list:
        """Extract daily check-ins with pagination"""
        items = []
        seen = set()
        stale_rounds = 0

        for _ in range(MAX_PAGINATION_STEPS):
            sections = driver.find_elements(By.CSS_SELECTOR, "section.daily-checkins")
            if student_index >= len(sections):
                break
            section = sections[student_index]
            previous_signature = self._section_signature(
                driver, "section.daily-checkins", student_index
            )

            entries = driver.execute_script(
                r"""
                const section = arguments[0];
                const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
                const cards = Array.from(section.querySelectorAll("div.border-b.p-6"));
                return cards.map((card) => {
                  const mood = text(card.querySelector("p.text-lg"));
                  const date = text(card.querySelector("p.text-sm.text-gray-500"));
                  const reflectionHeading = Array.from(card.querySelectorAll("p.text-md.font-semibold"))
                    .find((el) => /reflection/i.test(text(el)));
                  let reflection = "";
                  if (reflectionHeading) {
                    reflection = text(reflectionHeading.parentElement?.querySelector("p.text-sm.text-gray-700"));
                  }

                  const goalsHeading = Array.from(card.querySelectorAll("p.text-md.font-semibold"))
                    .find((el) => /goals/i.test(text(el)));
                  let goals = [];
                  if (goalsHeading) {
                    const goalsRoot = goalsHeading.parentElement;
                    const groups = Array.from(goalsRoot.querySelectorAll("div.mb-3, div.last\\:mb-0"));
                    if (groups.length === 0) {
                      const fallbackItems = Array.from(goalsRoot.querySelectorAll("li")).map((el) => text(el)).filter(Boolean);
                      if (fallbackItems.length > 0) {
                        goals.push({ title: "", items: fallbackItems });
                      }
                    } else {
                      goals = groups.map((group) => ({
                        title: text(group.querySelector("p.text-sm.font-semibold")),
                        items: Array.from(group.querySelectorAll("li")).map((el) => text(el)).filter(Boolean),
                      }));
                    }
                  }

                  return { mood, date, reflection, goals };
                });
                """,
                section,
            )

            before = len(seen)
            for entry in entries:
                key = json.dumps(
                    {
                        "mood": self._normalize_space(entry.get("mood", "")),
                        "date": self._normalize_space(entry.get("date", "")),
                        "reflection": self._normalize_space(entry.get("reflection", "")),
                        "goals": entry.get("goals", []),
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                )
                if key in seen:
                    continue
                seen.add(key)
                items.append(json.loads(key))

            if len(seen) == before:
                stale_rounds += 1
            else:
                stale_rounds = 0

            next_buttons = section.find_elements(
                By.XPATH,
                ".//button[normalize-space()='Next' or .//span[normalize-space()='Next']]",
            )
            if not next_buttons:
                break
            next_button = next_buttons[0]
            disabled = next_button.get_attribute("disabled") is not None or (
                not next_button.is_enabled()
            )
            if disabled or stale_rounds >= 2:
                break

            self._click_element(driver, next_button)
            self._wait_for_section_change(
                driver,
                "section.daily-checkins",
                student_index,
                previous_signature,
                timeout=3.0,
            )

        return items

    def _extract_point_histories_all_pages(self, driver, student_index: int) -> dict:
        """Extract point histories with pagination"""
        last_updated = ""
        total_point = ""
        items = []
        seen = set()
        none_text = ""
        stale_rounds = 0

        for _ in range(MAX_PAGINATION_STEPS):
            sections = driver.find_elements(By.CSS_SELECTOR, "section.point-histories")
            if student_index >= len(sections):
                break
            section = sections[student_index]
            previous_signature = self._section_signature(
                driver, "section.point-histories", student_index
            )

            payload = driver.execute_script(
                r"""
                const section = arguments[0];
                const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

                const lastUpdatedRaw = text(section.querySelector("[data-element='point-histories-last-update']"));
                const totalBlock = Array.from(section.querySelectorAll("div.flex.justify-between.items-center.border-b.p-6"))
                  .find((el) => /total point/i.test(text(el)));
                const totalPoint = totalBlock ? text(totalBlock.querySelector("p.text-lg, p.text-xl")) : "";
                const noneText = text(section.querySelector("[data-element='point-histories-none']"));

                const rows = Array.from(section.querySelectorAll("div.space-y-0 > div"))
                  .map((row) => {
                    const values = Array.from(row.querySelectorAll("p,span")).map((el) => text(el)).filter(Boolean);
                    const rawText = text(row);
                    return { values, raw_text: rawText };
                  })
                  .filter((row) => row.raw_text && !/you have no point histories data/i.test(row.raw_text));

                return {
                  last_updated: lastUpdatedRaw.replace(/^Last updated:\s*/i, ""),
                  total_point: totalPoint,
                  none_text: noneText,
                  rows
                };
                """,
                section,
            )

            last_updated = self._normalize_space(
                payload.get("last_updated", "") or last_updated
            )
            total_point = self._normalize_space(
                payload.get("total_point", "") or total_point
            )
            none_text = self._normalize_space(payload.get("none_text", "") or none_text)

            before = len(seen)
            for row in payload.get("rows", []):
                key = json.dumps(
                    {
                        "raw_text": self._normalize_space(row.get("raw_text", "")),
                        "values": [self._normalize_space(v) for v in row.get("values", [])],
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                )
                if key in seen:
                    continue
                seen.add(key)
                items.append(json.loads(key))

            if len(seen) == before:
                stale_rounds += 1
            else:
                stale_rounds = 0

            next_buttons = section.find_elements(
                By.XPATH,
                ".//button[normalize-space()='Next' or .//span[normalize-space()='Next']]",
            )
            if not next_buttons:
                break
            next_button = next_buttons[0]
            disabled = next_button.get_attribute("disabled") is not None or (
                not next_button.is_enabled()
            )
            if disabled or stale_rounds >= 2:
                break

            self._click_element(driver, next_button)
            self._wait_for_section_change(
                driver,
                "section.point-histories",
                student_index,
                previous_signature,
                timeout=3.0,
            )

        return {
            "last_updated": last_updated,
            "total_point": total_point,
            "items": items,
            "fallback_text_if_empty": none_text,
        }
