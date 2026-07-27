export function Footer() {
  return (
    <footer className="mt-12 border-t bg-card py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img
              src="/MM.jpeg"
              alt="Logo"
              className="h-6 w-6 rounded-lg object-contain"
            />
            <span>Manapalle Mutton & Chicken</span>
          </div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground/70">
            Fresh from the Village, Straight to Your Home — 9030901233
          </p>
        </div>
        <div className="mt-6 flex items-center justify-center border-t pt-4">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-primary/10 px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-primary shadow-sm ring-1 ring-primary/20">
            <span>Powered by</span>
            <a href="https://aplustechservices.in" target="_blank" rel="noopener noreferrer">
              <img
                src="/A+.jpeg"
                alt="A+ Tech"
                className="h-6 w-6 sm:h-8 sm:w-8 rounded object-contain"
              />
            </a>
            <span className="font-extrabold">A+ Tech Services</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
