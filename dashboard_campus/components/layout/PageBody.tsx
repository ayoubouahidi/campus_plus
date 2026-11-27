// Content column shared by every dashboard page: same padding and max width,
// so headers, cards and tables line up from page to page.
export default function PageBody({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>;
}
