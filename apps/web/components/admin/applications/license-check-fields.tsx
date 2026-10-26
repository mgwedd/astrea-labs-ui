import {
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@astrea/ui';

/** Source, result and date of the license lookup. Required to approve, optional to decline. */
export function LicenseCheckFields({ prefix, today, required }: { prefix: string; today: string; required?: boolean }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${prefix}-source`}>License checked against</FieldLabel>
        <Select name="source" defaultValue="board" required={required}>
          <SelectTrigger id={`${prefix}-source`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="board">State board</SelectItem>
              <SelectItem value="nppes">NPPES</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-result`}>Result{required ? '' : ' (optional)'}</FieldLabel>
        <Input id={`${prefix}-result`} name="result" required={required} maxLength={500} />
        <FieldDescription>What the lookup showed, e.g. license number and status.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-checked`}>Checked on{required ? '' : ' (optional)'}</FieldLabel>
        <Input
          id={`${prefix}-checked`}
          name="checkedOn"
          type="date"
          max={today}
          required={required}
          defaultValue={required ? today : undefined}
        />
      </Field>
    </>
  );
}
