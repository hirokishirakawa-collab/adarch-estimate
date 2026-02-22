"use client";

import { AlertDialog } from "radix-ui";
import { cn } from "@/lib/utils";

export const AlertDialogRoot = AlertDialog.Root;
export const AlertDialogTrigger = AlertDialog.Trigger;

export function AlertDialogContent({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AlertDialog.Content>) {
  return (
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <AlertDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-full max-w-md rounded-xl bg-white shadow-xl",
          "p-6 space-y-4",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
      </AlertDialog.Content>
    </AlertDialog.Portal>
  );
}

export function AlertDialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5", className)} {...props} />;
}

export const AlertDialogTitle = AlertDialog.Title;
export const AlertDialogDescription = AlertDialog.Description;

export function AlertDialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex justify-end gap-2 pt-2", className)}
      {...props}
    />
  );
}

export const AlertDialogCancel = AlertDialog.Cancel;
export const AlertDialogAction = AlertDialog.Action;
