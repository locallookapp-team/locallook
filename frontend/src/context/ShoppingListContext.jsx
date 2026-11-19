import React, { createContext, useContext, useState, useEffect } from 'react';

const ShoppingListContext = createContext();

export const useShoppingList = () => useContext(ShoppingListContext);

export const ShoppingListProvider = ({ children }) => {
  // 1. Initialize state from localStorage so the list survives page refreshes!
  const [shoppingList, setShoppingList] = useState(() => {
    try {
      const localData = localStorage.getItem('locallook_shopping_list');
      return localData ? JSON.parse(localData) : [];
    } catch (error) {
      return [];
    }
  });

  // 2. Auto-save to localStorage whenever the list changes
  useEffect(() => {
    localStorage.setItem('locallook_shopping_list', JSON.stringify(shoppingList));
  }, [shoppingList]);

  // 3. Add item function
  const addToList = (item, store, selections, quantity, total) => {
    setShoppingList((prev) => {
      // Check if the exact same item with the exact same variant options is already in the list
      const existingItemIndex = prev.findIndex(
        (i) => i.item_id === item.id && JSON.stringify(i.selections) === JSON.stringify(selections)
      );

      if (existingItemIndex >= 0) {
        // If it exists, just add the new quantity to the existing one
        const newList = [...prev];
        newList[existingItemIndex].quantity += quantity;
        newList[existingItemIndex].total += total;
        return newList;
      }

      // Otherwise, add it as a brand new row in the list
      return [...prev, {
        cart_id: Date.now().toString(), // Unique ID for this list entry
        item_id: item.id,
        item_name: item.item_name,
        image_url: item.image_url,
        store_id: store.id,
        store_name: store.store_name, // We save the store name to group them later!
        selections: selections,
        quantity: quantity,
        unit_price: total / quantity,
        total: total
      }];
    });
  };

  const removeFromList = (cartId) => {
    setShoppingList((prev) => prev.filter((item) => item.cart_id !== cartId));
  };

  const clearList = () => setShoppingList([]);

  return (
    <ShoppingListContext.Provider value={{ shoppingList, addToList, removeFromList, clearList }}>
      {children}
    </ShoppingListContext.Provider>
  );
};