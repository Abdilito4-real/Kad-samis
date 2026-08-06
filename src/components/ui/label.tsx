import * as React from "react";

interface Props extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: Props) {
  return <label className={["text-sm font-medium text-foreground", className].filter(Boolean).join(" ")} {...props} />;
}
