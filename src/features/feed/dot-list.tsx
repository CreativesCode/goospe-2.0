import { Children, Fragment, type ReactNode } from 'react'

/**
 * Fila de datos separados por "·" (rating · precio · distancia). Los hijos nulos se omiten,
 * así nunca queda un separador huérfano cuando falta el rating o el precio.
 */
export function DotList({ children, className }: { children: ReactNode; className?: string }) {
  const items = Children.toArray(children) // descarta null / false / undefined
  return (
    <div className={className}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="opacity-50">·</span>}
          {child}
        </Fragment>
      ))}
    </div>
  )
}
