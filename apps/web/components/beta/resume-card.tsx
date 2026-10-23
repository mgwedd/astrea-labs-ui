import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@astrea/ui';
import { ResumeSigningForm } from './email-request-form';

export function ResumeCard({
  title = 'Resume signing',
  description = 'Enter the email you applied with and we’ll send a new signing link. It works once and expires in 7 days.',
  children,
}: {
  title?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {children}
        <ResumeSigningForm />
      </CardContent>
    </Card>
  );
}
