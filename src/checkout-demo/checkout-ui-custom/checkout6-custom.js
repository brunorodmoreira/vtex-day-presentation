$(window).on('orderFormUpdated.vtex', function (e, orderForm) {
  $('body').hasClass('body-cart') && adjustDisplay(orderForm)
})

async function adjustDisplay(orderForm) {
  let hasUnavailability = false
  let formattedItems = orderForm.items.map((item) => {
    return {
      id: item.id,
      quantity: item.quantity,
      seller: item.seller,
    }
  })

  const response = await fetch('/api/checkout/pub/orderForms/simulation', {
    method: 'post',
    body: JSON.stringify({ items: formattedItems, country: 'BRA' }),
    headers: { 'Content-Type': 'application/json' },
  })

  const jsonResponse = await response.json()
  const newItems = jsonResponse.items

  $.each(orderForm.items, function (index, item) {
    const priceInfo = newItems.find((newItem) => {
      return newItem.id === item.id
    }).listPrice

    const formattedPrice = formatCurrency(priceInfo)
    const productElement = $('.cart-template-holder .cart .table.cart-items .product-item[data-sku="' + item.id + '"]')

    if ('cannotBeDelivered' === item.availability) {
      hasUnavailability = true
    }

    if ('kg' == item.measurementUnit) {
      $(productElement).find('.old-product-price').hide()
      $(productElement).find('.new-product-price').text(formatCurrency(item.sellingPrice)).hide()
      $(productElement).find('.new-product-real-price-per-unit').show()

      if (priceInfo !== item.price || $('.product-item[data-sku=' + item.id + '] .kg-product-list-price').length == 0) {
        $(
          '.cart-template-holder .cart .table.cart-items .product-item[data-sku=' +
            item.id +
            '] .v-custom-product-item-wrap .product-price .best-price'
        ).before(
          '<span class="kg-product-list-price"><p class="kg-product-list-price muted">' + formattedPrice + '</p></span>'
        )
      }
    }

    $(productElement).find('.new-product-real-price').text(formatCurrency(item.price))
    manageObservations(productElement, item, index)
    adjustUnits(productElement, item, index)
    verifyQuantityRestrictions(productElement, item, index)
  })

  if (hasUnavailability) {
    displayUnavailableShippingMsg()
  } else {
    $('.msgFreteIndisponivelCarrinho').remove()
  }
}

async function manageObservations(element, item, index) {
  if (verifyProductAttachment(item, 'Observação').length > 0) {
    $(element).addClass('withAttachment')
    $('.campoObsProduto').removeClass('observationLoader')

    let attachmentContent = checkProductAttachment(item, 'Observação')
    let noteContent = ''
    let noteTitle = 'Add Observation'
    $(element).find('.new-product-price').text(formatCurrency(item.price))

    if (attachmentContent.length > 0) {
      noteTitle = noteContent = attachmentContent[0].content.Observação
    }

    let noteLink = $(
      `<div class="linkObservacaoProduto linkObservacaoProduto-${item.id}" target="campoObsProduto-${item.id}">
                <i class="sprite-checkout ico_editar"></i>${noteTitle}
            </div>`
    )
    $(noteLink).click(function () {
      $(`#campoObsProduto-${item.id}`).addClass('active')
      $(`#linkObservacaoProduto${item.id}`).hide()
    })

    $(element).find('.product-name').append(noteLink)

    let noteField = $(
      `<div class="campoObsProduto" id="campoObsProduto-${item.id}">
                <input type="text" id="inputObsProduto-${item.id}" value="${noteContent}"/>
                <input type="button" class="btnObsProduto" value="Ok" id="btnObsProduto-${item.id}">
            </div>`
    )
    $(noteField)
      .find('.btnObsProduto')
      .on('click', function () {
        let inputContent = $(`#inputObsProduto-${item.id}`).val()
        $('.campoObsProduto').addClass('observationLoader')

        if (inputContent !== '') {
          updateProductAttachment(index, 'Observação', inputContent)
          $(`#linkObservacaoProduto${item.id}`).hide()
        } else {
          updateProductAttachment(index, 'Observação', inputContent)
          $(`#campoObsProduto-${item.id}`).removeClass('active')
          $(`#linkObservacaoProduto${item.id}`).show()
        }
        $('.campoObsProduto').removeClass('observationLoader')
      })
    $(element).find('.product-name').append(noteField)
  }
}

async function adjustUnits(element, item, index) {
  let incrementButton = $(`#item-quantity-change-increment-${item.id}`)
  let decrementButton = $(`#item-quantity-change-decrement-${item.id}`)
  let inputField = $(`td.quantity input#item-quantity-${item.id}`)
  let isKg = item.measurementUnit === 'kg'
  let quantity = $(element).find('.quantity')

  if (isKg) {
    $(inputField).off()
    $(inputField).attr('qtdUnitaria', item.quantity)
    $(inputField).val(convertQtdFactorKg(item.quantity, item.unitMultiplier, 1))
    $(inputField).attr('class', 'inputKg')
    $(inputField).after('<span class="unidadeKg">Kg</span>')

    $(incrementButton).on('click', function () {
      $(this).off()
      $('.cart-template-holder .cart .table.cart-items td.quantity input').attr('disabled', true)
      updateProductQuantity(index, item.quantity + 1)
    })
    $(decrementButton).on('click', function () {
      $(this).unbind()
      $('.cart-template-holder .cart .table.cart-items td.quantity input').attr('disabled', true)
      updateProductQuantity(index, item.quantity - 1)
    })
  } else {
    if (item.quantity.length < 2) {
      quantity.find('input').val('0' + item.quantity)
    }
  }

  $(incrementButton).bindFirst('click', function () {
    $('td.quantity').addClass('qty-loading')
  })

  $(decrementButton).bindFirst('click', function () {
    $('td.quantity').addClass('qty-loading')
  })

  $('.item-quantity-change').on('click', function () {
    if (quantity.hasClass('qty-loading')) {
      $('.item-quantity-change').addClass('disabled')
    }
  })

  quantity.removeClass('qty-loading')
  $('.item-quantity-change').removeClass('disabled')
}

async function verifyQuantityRestrictions(element, item, index) {
  let incrementButton = $(`#item-quantity-change-increment-${item.id}`)
  let decrementButton = $(`#item-quantity-change-decrement-${item.id}`)
  let isKg = item.measurementUnit === 'kg'

  let productInfo = await queryProductApi(item)
  if (productInfo['Limitador de quantidade']) {
    if (productInfo['Quantidade Mínima']) {
      let minimumQuantity = Math.ceil(productInfo['Quantidade Mínima'][0].replace(',', '.'))
      if (item.quantity <= minimumQuantity) {
        let msgContent = isKg
          ? convertQtdFactorKg(minimumQuantity, item.unitMultiplier, 1).toString() + 'kg'
          : minimumQuantity
        let alertMsg = $(
          `<div class="msgAlertaQtd" id="msgAlertaMinimo-${item.id}">
                        <i class="sprite-checkout ico-sinal-de-aviso"></i>
                        <span>
                            The minimum quantity to purchase this product is [QtdMinima].
                        </span>
                    </div>`
        ).replace('[QtdMinima]', msgContent)

        $(decrementButton).after(alertMsg)
        $(decrementButton).addClass('btQuantidadeDesabilitado')
        $(decrementButton).unbind()

        $(decrementButton).hover(
          function () {
            $(`#msgAlertaMinimo-${item.id}`).addClass('active')
          },
          function () {
            $(`#msgAlertaMinimo-${item.id}`).removeClass('active')
          }
        )
      }
    }

    if (productInfo['Quantidade Máxima']) {
      let maximumQuantity = Math.ceil(productInfo['Quantidade Máxima'][0].replace(',', '.'))
      if (item.quantity >= maximumQuantity) {
        let msgContent = isKg
          ? convertQtdFactorKg(maximumQuantity, item.unitMultiplier, 1).toString() + 'kg'
          : maximumQuantity
        let alertMsg = $(
          `<div class="msgAlertaQtd" id="msgAlertaMaximo-${item.id}">
                        <i class="sprite-checkout ico-sinal-de-aviso"></i>
                        <span>
                            To add a quantity greater than [QtdMaxima], please contact us by phone (48) 4002 6060.
                        </span>
                    </div>`
        ).replace('[QtdMaxima]', msgContent)

        $(incrementButton).after(alertMsg)
        $(incrementButton).addClass('btQuantidadeDesabilitado')
        $(incrementButton).unbind()

        $(incrementButton).hover(
          function () {
            $(`#msgAlertaMaximo-${item.id}`).addClass('active')
          },
          function () {
            $(`#msgAlertaMaximo-${item.id}`).removeClass('active')
          }
        )

        $('.quantity input').each(function () {
          if ($(this).val() > maximumQuantity) {
            $(this).val(maximumQuantity)
          }
        })
      }
    }
  }
}

function checkProductAttachment(e, t) {
  return e.attachments.filter(function (e) {
    return e.name === t
  })
}

function verifyProductAttachment(e, t) {
  return e.attachmentOfferings.filter(function (e) {
    return e.name === t
  })
}

function formatCurrency(e) {
  var t = Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      useGrouping: !0,
    }),
    o = (e / 100).toFixed(2)
  return t.format(o)
}

function updateProductAttachment(e, t, o) {
  var a = n()({}, t, o)
  o.length > 0
    ? vtexjs.checkout.addItemAttachment(e, t, a, null, !1)
    : vtexjs.checkout.removeItemAttachment(e, t, a, null, !1)
}

function convertQtdFactorKg(e, t, o) {
  return (e * t).toFixed(o).replace('.', ',')
}

function updateProductQuantity(e, t) {
  var o = { index: e, quantity: t }
  return vtexjs.checkout.updateItems([o], null, !1)
}

async function queryProductApi(product) {
  const options = {
    method: 'GET',
    headers: { Accept: 'application/json' },
  }

  try {
    const response = await fetch(`/api/catalog_system/pub/products/search?fq=productId:${product.productId}`, options)
    const data = await response.json()

    if (data.length > 0) {
      return data[0]
    }
  } catch (error) {
    console.error(error)
  }
}
