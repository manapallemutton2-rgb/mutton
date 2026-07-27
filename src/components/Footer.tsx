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
        <div className="mt-6 flex items-center justify-center gap-2 border-t pt-4 text-sm font-semibold text-muted-foreground/60">
          <span>Powered by</span>
          <img
            src="/A+.jpeg"
            alt="A+ Tech"
            className="h-6 w-6 rounded object-contain"
          />
          <span className="font-bold">A+ Tech Services</span>
        </div>
      </div>
    </footer>
  );
}
