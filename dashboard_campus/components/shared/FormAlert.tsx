// General form or page error (anything that doesn't belong to one field).
// role="alert" makes screen readers announce it as soon as it appears.
export default function FormAlert({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
    >
      {message}
    </p>
  );
}
