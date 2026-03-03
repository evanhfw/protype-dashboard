export default function FooterSection() {
  return (
    <footer id="about" className="relative border-t border-border/30 py-16 px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25">
                <span className="text-white font-bold text-sm">dC</span>
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                diCodex
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              An open-source education analytics dashboard built for DBS Foundation Coding Camp facilitators
              to track cohort progress effortlessly.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Quick Links</h4>
            <div className="flex flex-col gap-2">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </a>
              <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Upload Page
              </a>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Resources</h4>
            <div className="flex flex-col gap-2">
              <a
                href="https://github.com/evanhfw/dicodex"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://www.dicoding.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Dicoding
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} diCodex. Open-source under MIT License.
          </p>
          <p className="text-xs text-muted-foreground">
            Built with ❤️ for DBS Foundation Coding Camp
          </p>
        </div>
      </div>
    </footer>
  );
}
