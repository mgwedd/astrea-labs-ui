export default function Forbidden() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-start justify-center gap-4 py-16">
      <h1 className="text-2xl font-semibold">403: not authorized</h1>
      <p className="text-muted-foreground">This account is not on the admin list, or its email is not verified.</p>
      <a href="/auth/logout" className="text-sm underline underline-offset-4">
        Sign out
      </a>
    </div>
  );
}
