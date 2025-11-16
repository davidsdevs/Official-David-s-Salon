import * as React from "react"
import Button from "./Button"
import { cn } from "../../lib/utils"

const ConsistentButton = React.forwardRef(({ 
  className,
  variant = "primary",
  size = "default",
  children,
  ...props 
}, ref) => {
  const variantClasses = {
    primary: "bg-[#160B53] hover:bg-[#160B53]/90 text-white font-poppins font-semibold",
    outline: "border-[#160B53] text-[#160B53] hover:bg-[#160B53] hover:text-white font-poppins font-semibold",
    outlineWhite: "border-white text-white hover:bg-white hover:text-[#160B53] font-poppins font-semibold",
    white: "bg-white text-[#160B53] hover:bg-gray-100 font-poppins font-semibold",
    destructive: "border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-poppins font-semibold",
    ghost: "text-[#160B53] hover:bg-[#160B53]/10 font-poppins font-medium"
  }

  const sizeClasses = {
    sm: "h-8 px-3 text-sm",
    default: "h-9 px-4",
    lg: "h-10 px-6 text-base",
    xl: "h-12 px-8 text-lg"
  }

  return (
    <Button
      className={cn(
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
})

ConsistentButton.displayName = "ConsistentButton"

// Pre-configured button variants for common use cases
const CTAButton = React.forwardRef(({ className, children, ...props }, ref) => (
  <ConsistentButton
    ref={ref}
    variant="primary"
    size="lg"
    className={cn("w-full sm:w-auto", className)}
    {...props}
  >
    {children}
  </ConsistentButton>
))

const SecondaryButton = React.forwardRef(({ className, children, ...props }, ref) => (
  <ConsistentButton
    ref={ref}
    variant="outline"
    size="lg"
    className={cn("w-full sm:w-auto", className)}
    {...props}
  >
    {children}
  </ConsistentButton>
))

const NavigationButton = React.forwardRef(({ className, children, ...props }, ref) => (
  <ConsistentButton
    ref={ref}
    variant="outline"
    size="default"
    className={cn("bg-transparent", className)}
    {...props}
  >
    {children}
  </ConsistentButton>
))

CTAButton.displayName = "CTAButton"
SecondaryButton.displayName = "SecondaryButton"
NavigationButton.displayName = "NavigationButton"

export { 
  ConsistentButton, 
  CTAButton, 
  SecondaryButton, 
  NavigationButton 
}

