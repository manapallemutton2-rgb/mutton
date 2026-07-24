import { Wrench } from "lucide-react";

export function MaintenanceScreen({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg text-center">
        <img
          src="/MM.jpeg"
          alt="Logo"
          className="mx-auto mb-6 h-24 w-24 rounded-2xl object-contain shadow-lg"
        />
        <h1 className="text-4xl font-bold text-primary leading-tight">
          Manapalle
          <span className="block text-xl font-medium opacity-80">Mutton & Chicken</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fresh from the Village, Straight to Your Home
        </p>
        <div className="mt-8 rounded-2xl border bg-card p-10 shadow-sm">
          <Wrench className="mx-auto mb-6 h-16 w-16 text-orange-500" />
          <h2 className="text-2xl font-semibold">Under Maintenance</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {message || "We are currently under maintenance. Please try again later."}
          </p>
          <p className="mt-6 text-base text-muted-foreground">
            We'll be back soon. Thank you for your patience.
          </p>
        </div>
      </div>
    </div>
  );
}
