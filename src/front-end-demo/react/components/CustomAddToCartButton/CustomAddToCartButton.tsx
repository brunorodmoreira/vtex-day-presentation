import React, { FC, useMemo } from 'react'
import { useOrderItems } from 'vtex.order-items/OrderItems'
import { OrderForm, useOrderForm } from 'vtex.order-manager/OrderForm'
import { useProduct } from 'vtex.product-context'
import { Button } from 'vtex.styleguide'
import { updateShippingData, regionalize, showToast } from './utils'

type ExtendedOrderForm = OrderForm & {
  items: Array<{
    id: string
    quantity: number
  }>
}


const CustomAddToCartButton: FC = () => {
  const productContextValue = useProduct()

  const { orderForm, orderForm: { items }, loading, setOrderForm } = useOrderForm<ExtendedOrderForm>()
  const { addItems, updateQuantity } = useOrderItems()

  const itemId = productContextValue?.selectedItem?.itemId

  const sellerId = useMemo(() => productContextValue?.selectedItem?.sellers.find((seller) => seller.sellerDefault)?.sellerId, [productContextValue])

  const quantityAlreadyInCart = useMemo(() => items.find((item => item.id === itemId))?.quantity || 0, [items, itemId])

  const handleAddToCart = async (mode: 'new' | 'add' | 'remove') => {
    if (!itemId || !sellerId) {
      return
    }

    if (mode === 'new') {
      const items = [{ id: itemId, quantity: 1, seller: sellerId }]

      await addItems(items)
    } else if (mode === 'add') {
      const item = {
        id: itemId,
        quantity: quantityAlreadyInCart + 1,
        seller: sellerId,
      }

      await updateQuantity(item)
    } else if (mode === 'remove') {
      const item = {
        id: itemId,
        quantity: quantityAlreadyInCart - 1,
        seller: sellerId,
      }

      await updateQuantity(item)
    }

    await updateShippingData(orderForm, setOrderForm)
    await regionalize(itemId, sellerId, setOrderForm)

    showToast(mode === 'new' ? 'Item added to cart' : 'Quantity updated')
  }

  return (
    <div>
      {quantityAlreadyInCart ? (
        <div>
          <Button isLoading={loading} onClick={() => handleAddToCart('remove')}>-</Button>
          <span>{quantityAlreadyInCart}</span>
          <Button isLoading={loading} onClick={() => handleAddToCart('add')}>+</Button>
        </div>

      ) : (
        <Button isLoading={loading} onClick={() => handleAddToCart('new')}>Add to cart</Button>
      )}
    </div>
  )
}

export default CustomAddToCartButton
