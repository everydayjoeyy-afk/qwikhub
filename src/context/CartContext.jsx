import { createContext, useContext, useState } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([])

  const count = items.length

  const addToCart = (item) =>
    setItems(prev => [...prev, { ...item, id: Date.now() + Math.random() }])

  const removeFromCart = (id) =>
    setItems(prev => prev.filter(i => i.id !== id))

  const clearCart = () => setItems([])

  const total = items.reduce((sum, i) => sum + i.price, 0)

  return (
    <CartContext.Provider value={{ items, count, total, addToCart, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
