import * as React from "react"
import { Search } from "lucide-react"
import { Input } from "./Input"
import { cn } from "../../lib/utils"

const SearchInput = React.forwardRef(({ 
  className, 
  placeholder = "Search...", 
  value, 
  onChange,
  iconColor = "#6B6B6B",
  ...props 
}, ref) => {
  return (
    <div className="relative">
      <Search 
        className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" 
        style={{ color: iconColor }} 
      />
      <Input
        ref={ref}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={cn(
          "pl-10 pr-4 transition-all duration-300 focus:ring-2 focus:ring-[#160B53]/20",
          className
        )}
        style={{ 
          borderColor: '#4A4A4A', 
          color: '#6B6B6B',
          ...props.style 
        }}
        {...props}
      />
    </div>
  )
})

SearchInput.displayName = "SearchInput"

export { SearchInput }

