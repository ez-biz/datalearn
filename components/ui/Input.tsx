import { forwardRef } from "react"
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

const fieldBase =
    "block w-full rounded-md border border-border bg-surface text-foreground placeholder:text-muted-foreground/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...props }, ref) => (
        <input
            ref={ref}
            className={cn(fieldBase, "h-10 px-3 text-sm", className)}
            {...props}
        />
    )
)
Input.displayName = "Input"

export const Textarea = forwardRef<
    HTMLTextAreaElement,
    TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
    <textarea
        ref={ref}
        className={cn(fieldBase, "px-3 py-2 text-sm leading-relaxed font-mono", className)}
        {...props}
    />
))
Textarea.displayName = "Textarea"

interface FieldProps {
    label: string
    htmlFor: string
    description?: string
    error?: string
    required?: boolean
    children: React.ReactNode
}

export function Field({ label, htmlFor, description, error, required, children }: FieldProps) {
    return (
        <div className="space-y-1.5">
            <label
                htmlFor={htmlFor}
                className="block text-sm font-medium text-foreground"
            >
                {label}
                {required && <span className="text-destructive ml-0.5">*</span>}
            </label>
            {children}
            {description && !error && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    )
}
