"""
Dicoding Coding Camp Scraper Service
Adapted from diCodex/main.py to work with Playwright browser automation.
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

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from dotenv import load_dotenv

# Load environment variables from root directory
# In Docker, env vars are injected directly, so this is mainly for local dev
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent.parent / ".env")

# Configuration
CODINGCAMP_URL = os.getenv("CODINGCAMP_URL", "https://codingcamp.dicoding.com")
OUTPUT_DIR = Path("/app/output")
MAX_PAGINATION_STEPS = 300
INTERACTION_TIMEOUT_SECONDS = 20
FAST_PAGINATION_DELAY_MS = 120


class InvalidCredentialsError(Exception):
    """Raised when login credentials are rejected by the site."""
    pass


class ScraperService:
    """
    Scrapes Dicoding Coding Camp student data via Playwright.

    This class is stateless — each call to run_scraper() creates its own
    Playwright session. Job lifecycle is managed by ARQ.
    """

    def run_scraper(
        self,
        email=None,
        password=None,
        on_progress=None,
        progress_callback=None,
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

        playwright, browser, page = self._build_browser()

        try:
            if progress_callback:
                progress_callback("Initializing scraper...", 1, 100)

            # Navigate and login
            if progress_callback:
                progress_callback("Navigating to login page...", 5, 100)

            page.goto(CODINGCAMP_URL)
            self._wait_for_page_ready(page)
            self._click_password_link(page)

            if progress_callback:
                progress_callback("Logging in...", 10, 100)
            self._login_with_email_password(page, scraper_email, scraper_password)

            # Wait for redirect after login, detecting invalid credentials
            try:
                page.wait_for_function(
                    "() => !window.location.href.includes('/login')", timeout=30000
                )
            except PlaywrightTimeoutError:
                error_msg = self._check_login_error(page)
                if error_msg:
                    raise InvalidCredentialsError(f"Login failed — {error_msg}")
                raise InvalidCredentialsError(
                    "Login failed. The email or password may be incorrect."
                )

            self._wait_for_page_ready(page)

            # Extract mentor info immediately for notification
            mentor_info = self._extract_mentor_from_dom(page)
            if on_progress:
                on_progress("started", mentor_info)
            if progress_callback:
                progress_callback("Expanding student list...", 15, 100)

            # Expand all student data
            self._expand_all_student_data(page)
            self._wait_until(
                lambda: len(page.query_selector_all("section.daily-checkins")) > 0,
                timeout=8,
            )

            if progress_callback:
                progress_callback("Extracting student data...", 20, 100)

            # Extract and save data
            payload = self._build_export_json(page, progress_callback)

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
            try:
                browser.close()
            finally:
                playwright.stop()

    def _build_browser(self) -> tuple[Any, Any, Any]:
        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-software-rasterizer",
                "--window-size=1280,720",
            ],
        )
        page = browser.new_page()
        return playwright, browser, page

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
    def _find_first_visible(page, selectors):
        for selector in selectors:
            for element in page.query_selector_all(selector):
                if element.is_visible():
                    return element
        return None

    @staticmethod
    def _wait_for_page_ready(page):
        page.wait_for_function("() => document.readyState === 'complete'", timeout=30000)
        page.wait_for_selector("body", timeout=30000)

    @staticmethod
    def _click_element(page, element):
        element.scroll_into_view_if_needed()
        try:
            element.click()
        except Exception:
            page.evaluate("(element) => element.click()", element)

    def _click_password_link(self, page):
        selectors = [
            "a:has-text('your password')",
            "xpath=//a[normalize-space()='your password']",
            "xpath=//a[contains(normalize-space(.), 'your password')]",
        ]

        for selector in selectors:
            try:
                element = page.wait_for_selector(selector, state="visible", timeout=5000)
                self._click_element(page, element)
                return
            except PlaywrightTimeoutError:
                continue

        raise RuntimeError("Link 'your password' not found")

    @staticmethod
    def _check_login_error(page) -> str | None:
        """Check the page for login error messages. Returns the error text if found, None otherwise."""
        error_selectors = [
            "[role='alert']",
            ".alert-danger",
            ".error-message",
            ".toast-error",
            "[data-testid='error']",
        ]
        for selector in error_selectors:
            elements = page.query_selector_all(selector)
            for el in elements:
                text = (el.text_content() or "").strip()
                if el.is_visible() and text:
                    return text

        error_keywords = ["invalid", "incorrect", "wrong", "salah", "gagal", "failed"]
        try:
            body = page.query_selector("body")
            page_text = (body.text_content() if body else "").lower()
            for keyword in error_keywords:
                if keyword in page_text and "/login" in page.url:
                    return f"Login page shows an error (detected keyword: '{keyword}')"
        except Exception:
            pass

        return None

    def _check_login_result(self, page) -> bool:
        """
        Condition for login wait: returns True when login succeeded (redirected away from /login).
        Raises InvalidCredentialsError early if an error message is detected on the page.
        """
        if "/login" not in page.url:
            return True

        error_msg = self._check_login_error(page)
        if error_msg:
            raise InvalidCredentialsError(
                f"Login failed — the site returned an error: {error_msg}"
            )

        return False

    def _login_with_email_password(self, page, email: str, password: str):
        page.wait_for_selector("input[type='password']", state="visible", timeout=30000)

        if not email or not password:
            raise ValueError("EMAIL/PASSWORD empty. Credentials must be provided.")

        email_input = self._find_first_visible(
            page,
            [
                "input[type='email']",
                "input[name='email']",
                "input#email",
            ],
        )
        password_input = self._find_first_visible(
            page,
            [
                "input[type='password']",
                "input[name='password']",
                "input#password",
            ],
        )
        submit_button = self._find_first_visible(
            page,
            [
                "button[type='submit']",
                "input[type='submit']",
                "xpath=//button[contains(., 'Sign in') or contains(., 'Login') or contains(., 'Masuk')]",
            ],
        )

        if not email_input or not password_input or not submit_button:
            raise RuntimeError("Login form components not found")

        email_input.fill(email)
        password_input.fill(password)
        self._click_element(page, submit_button)

    def _expand_all_student_data(self, page):
        """Expand all student data sections"""
        text_normalizer = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        text_lower = "abcdefghijklmnopqrstuvwxyz"

        student_input_selectors = [
            "xpath="
            f"//input[contains(translate(@placeholder, '{text_normalizer}', '{text_lower}'), 'student') "
            f"and contains(translate(@placeholder, '{text_normalizer}', '{text_lower}'), 'id')]",
            "xpath="
            f"//input[contains(translate(@aria-label, '{text_normalizer}', '{text_lower}'), 'student') "
            f"and contains(translate(@aria-label, '{text_normalizer}', '{text_lower}'), 'id')]",
            "xpath="
            f"//div[contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), \"student's name or id\")]",
        ]
        select_all_selectors = [
            "xpath="
            f"//button[contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), 'select all')]",
            "xpath="
            f"//label[contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), 'select all')]",
            "xpath="
            f"//span[contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), 'select all')]",
        ]
        expand_all_selectors = [
            "xpath="
            f"//button[contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), 'expand all')]",
            "xpath="
            f"//span[contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), 'expand all')]",
            "xpath="
            f"//*[@role='button' and contains(translate(normalize-space(.), '{text_normalizer}', '{text_lower}'), 'expand all')]",
        ]

        self._click_from_locators(page, student_input_selectors, "Input student's name or ID")
        self._wait_for_any_locator(page, select_all_selectors, timeout=5)
        self._click_from_locators(page, select_all_selectors, "Select All")
        self._wait_for_any_locator(page, expand_all_selectors, timeout=5)
        self._click_from_locators(page, expand_all_selectors, "Expand All")
        self._wait_until(
            lambda: len(page.query_selector_all("section.point-histories")) > 0,
            timeout=8,
        )

    def _click_from_locators(self, page, locators, action_label):
        deadline = time.time() + INTERACTION_TIMEOUT_SECONDS
        last_error = None

        while time.time() < deadline:
            for selector in locators:
                element = self._find_first_visible(page, [selector])
                if not element:
                    continue
                try:
                    self._click_element(page, element)
                    return
                except Exception as error:
                    last_error = error
            time.sleep(0.1)

        message = f"Failed to click '{action_label}'"
        if last_error:
            raise RuntimeError(f"{message}. Detail: {last_error}") from last_error
        raise RuntimeError(message)

    def _build_export_json(
        self,
        page,
        progress_callback: Optional[Callable[[str, int, int], None]] = None,
    ) -> dict:
        """Build the JSON export from scraped data"""
        mentor = self._extract_mentor_from_dom(page)

        # Click show all buttons
        self._click_all_buttons_by_keyword(page, "show all attendances")
        show_all_courses_clicked = self._click_all_buttons_by_keyword(page, "show all courses")
        show_all_assignments_clicked = self._click_all_buttons_by_keyword(
            page, "show all assignments"
        )
        show_all_attendances_clicked = self._click_all_buttons_by_keyword(
            page, "show all attend"
        )

        source = page.content()
        blocks = self._student_blocks(source)

        if not blocks:
            raise RuntimeError("No student blocks found")

        students = [self._parse_student(block) for block in blocks]
        total_students = len(students)
        fast_attendance_by_student: list[dict] | None = None
        fast_daily_by_student: list[list[dict]] | None = None
        fast_point_by_student: list[dict] | None = None

        try:
            fast_attendance_by_student = self._extract_attendances_all_students_fast(
                page
            )
        except Exception:
            fast_attendance_by_student = None

        if progress_callback:
            progress_callback("Collecting daily check-ins in bulk...", 25, 100)
        try:
            fast_daily_by_student = self._extract_daily_checkins_all_students_fast(page)
        except Exception:
            fast_daily_by_student = None

        if progress_callback:
            progress_callback("Collecting point histories in bulk...", 30, 100)
        try:
            fast_point_by_student = self._extract_point_histories_all_students_fast(page)
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
                    "items": self._extract_daily_checkins_all_pages(page, idx)
                }

            if fast_point_by_student and idx < len(fast_point_by_student):
                students[idx]["progress"]["point_histories"] = fast_point_by_student[idx]
            else:
                students[idx]["progress"]["point_histories"] = (
                    self._extract_point_histories_all_pages(page, idx)
                )

        return {
            "metadata": {
                "generated_at_utc": datetime.now(timezone.utc).isoformat(),
                "source_url": page.url,
                "student_total": len(students),
                "show_all_courses_clicked": show_all_courses_clicked,
                "show_all_assignments_clicked": show_all_assignments_clicked,
                "show_all_attendances_clicked": show_all_attendances_clicked,
            },
            "mentor": mentor,
            "students": students,
        }

    def _extract_mentor_from_dom(self, page) -> dict:
        """Extract mentor information from DOM"""
        data = page.evaluate(
            r"""
            () => {
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
            }
            """
        )
        return {
            "group": data.get("group", ""),
            "mentor_code": data.get("mentor_code", ""),
            "name": data.get("name", ""),
            "nav_items": data.get("nav_items", []),
        }

    def _click_all_buttons_by_keyword(self, page, keyword: str, max_clicks: int = 500) -> int:
        """Click all buttons containing a keyword"""
        keyword = keyword.lower()
        payload = page.evaluate(
            """
            async ({ keyword, maxClicks }) => {
            const text = (el) => (el?.textContent || "").replace(/\\s+/g, " ").trim().toLowerCase();
            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

            try {
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

              return { ok: true, clicked };
            } catch (error) {
              return { ok: false, error: String(error) };
            }
            }
            """,
            {"keyword": keyword, "maxClicks": max_clicks},
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
                buttons = page.query_selector_all(f"xpath={xpath}")
                target = None
                for button in buttons:
                    if button.is_visible():
                        target = button
                        break
                if not target:
                    break
                self._click_element(page, target)
                clicked += 1
                time.sleep(0.05)
            return clicked
        return int(payload.get("clicked", 0))

    def _extract_daily_checkins_all_students_fast(self, page) -> list[list[dict]]:
        """Extract daily check-ins for all students with one async browser script."""
        payload = page.evaluate(
            r"""
            async (delayMs) => {
            delayMs = Number(delayMs || 80);
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

            try {
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

              return { ok: true, items: allItems };
            } catch (error) {
              return { ok: false, error: String(error) };
            }
            }
            """,
            FAST_PAGINATION_DELAY_MS,
        )

        if not payload or not payload.get("ok"):
            message = payload.get("error") if isinstance(payload, dict) else payload
            raise RuntimeError(f"Fast extraction daily-checkins failed: {message}")
        return payload.get("items", [])

    def _extract_point_histories_all_students_fast(self, page) -> list[dict]:
        """Extract point histories for all students with one async browser script."""
        payload = page.evaluate(
            r"""
            async (delayMs) => {
            delayMs = Number(delayMs || 80);
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

            try {
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

              return { ok: true, items: allItems };
            } catch (error) {
              return { ok: false, error: String(error) };
            }
            }
            """,
            FAST_PAGINATION_DELAY_MS,
        )

        if not payload or not payload.get("ok"):
            message = payload.get("error") if isinstance(payload, dict) else payload
            raise RuntimeError(f"Fast extraction point-histories failed: {message}")
        return payload.get("items", [])

    def _wait_for_any_locator(self, page, locators, timeout: float = 5.0) -> bool:
        """Wait until any locator in list becomes visible."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            element = self._find_first_visible(page, locators)
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

    def _section_signature(self, page, selector: str, section_index: int) -> str:
        """Return a compact signature for section content to detect page changes."""
        return page.evaluate(
            r"""
            ({ selector, index }) => {
            const sections = document.querySelectorAll(selector);
            if (!sections || sections.length <= index) return "";
            const section = sections[index];
            const text = (section.textContent || "").replace(/\s+/g, " ").trim();
            return text.slice(0, 4000);
            }
            """,
            {"selector": selector, "index": section_index},
        ) or ""

    def _wait_for_section_change(
        self,
        page,
        selector: str,
        section_index: int,
        previous_signature: str,
        timeout: float = 4.0,
    ) -> bool:
        """Wait until section content changes after pagination click."""
        return self._wait_until(
            lambda: (
                (current := self._section_signature(page, selector, section_index))
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

    def _extract_attendances_all_students_fast(self, page) -> list[dict]:
        """Extract attendance section for all students in one browser call."""
        payload = page.evaluate(
            r"""
            () => {
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
            }
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

    def _extract_daily_checkins_all_pages(self, page, student_index: int) -> list:
        """Extract daily check-ins with pagination"""
        items = []
        seen = set()
        stale_rounds = 0

        for _ in range(MAX_PAGINATION_STEPS):
            sections = page.query_selector_all("section.daily-checkins")
            if student_index >= len(sections):
                break
            section = sections[student_index]
            previous_signature = self._section_signature(
                page, "section.daily-checkins", student_index
            )

            entries = page.evaluate(
                r"""
                (section) => {
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
                }
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

            next_buttons = section.query_selector_all(
                "xpath=.//button[normalize-space()='Next' or .//span[normalize-space()='Next']]"
            )
            if not next_buttons:
                break
            next_button = next_buttons[0]
            disabled = next_button.get_attribute("disabled") is not None or (
                not next_button.is_enabled()
            )
            if disabled or stale_rounds >= 2:
                break

            self._click_element(page, next_button)
            self._wait_for_section_change(
                page,
                "section.daily-checkins",
                student_index,
                previous_signature,
                timeout=3.0,
            )

        return items

    def _extract_point_histories_all_pages(self, page, student_index: int) -> dict:
        """Extract point histories with pagination"""
        last_updated = ""
        total_point = ""
        items = []
        seen = set()
        none_text = ""
        stale_rounds = 0

        for _ in range(MAX_PAGINATION_STEPS):
            sections = page.query_selector_all("section.point-histories")
            if student_index >= len(sections):
                break
            section = sections[student_index]
            previous_signature = self._section_signature(
                page, "section.point-histories", student_index
            )

            payload = page.evaluate(
                r"""
                (section) => {
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
                }
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

            next_buttons = section.query_selector_all(
                "xpath=.//button[normalize-space()='Next' or .//span[normalize-space()='Next']]"
            )
            if not next_buttons:
                break
            next_button = next_buttons[0]
            disabled = next_button.get_attribute("disabled") is not None or (
                not next_button.is_enabled()
            )
            if disabled or stale_rounds >= 2:
                break

            self._click_element(page, next_button)
            self._wait_for_section_change(
                page,
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
