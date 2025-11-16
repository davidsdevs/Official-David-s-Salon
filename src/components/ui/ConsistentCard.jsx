import * as React from "react"
import { cn } from "../../lib/utils"

const ConsistentCard = React.forwardRef(({ 
  className, 
  hoverable = true,
  shadowVariant = "default",
  children,
  ...props 
}, ref) => {
  const shadowClasses = {
    default: "shadow-md hover:shadow-lg",
    custom: "shadow-[0_2px_15px_0_rgba(0,0,0,0.25)]",
    hover: "shadow-md hover:shadow-xl hover:scale-105 hover:ring-2 hover:ring-[#160B53]/20",
    none: "shadow-none"
  }

  return (
    <div
      ref={ref}
      className={cn(
        "bg-white rounded-lg overflow-hidden transition-all duration-300",
        hoverable && "cursor-pointer transform",
        shadowClasses[shadowVariant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

ConsistentCard.displayName = "ConsistentCard"

const ConsistentCardContent = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("p-6", className)}
      {...props}
    />
  )
})

ConsistentCardContent.displayName = "ConsistentCardContent"

export { ConsistentCard, ConsistentCardContent }

