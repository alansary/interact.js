import { Action, Interaction } from '@interactjs/core/Interaction'
import { Scope } from '@interactjs/core/scope'
import * as utils from '@interactjs/utils'

export type EdgeName = 'top' | 'left' | 'bottom' | 'right'

function install (scope: Scope) {
  const {
    actions,
    browser,
    /** @lends Interactable */
    Interactable, // tslint:disable-line no-shadowed-variable
    interactions,
    defaults,
  } = scope

  // Less Precision with touch input

  interactions.signals.on('new', (interaction: Interaction) => {
    interaction.resizeAxes = 'xy'
  })

  interactions.signals.on('action-start', start)
  interactions.signals.on('action-move', move)

  interactions.signals.on('action-start', updateEventAxes)
  interactions.signals.on('action-move', updateEventAxes)

  resize.cursors = initCursors(browser)
  resize.defaultMargin = browser.supportsTouch || browser.supportsPointerEvent ? 20 : 10

  /**
   * ```js
   * interact(element).resizable({
   *   onstart: function (event) {},
   *   onmove : function (event) {},
   *   onend  : function (event) {},
   *
   *   edges: {
   *     top   : true,       // Use pointer coords to check for resize.
   *     left  : false,      // Disable resizing from left edge.
   *     bottom: '.resize-s',// Resize if pointer target matches selector
   *     right : handleEl    // Resize if pointer target is the given Element
   *   },
   *
   *     // Width and height can be adjusted independently. When `true`, width and
   *     // height are adjusted at a 1:1 ratio.
   *     square: false,
   *
   *     // Width and height can be adjusted independently. When `true`, width and
   *     // height maintain the aspect ratio they had when resizing started.
   *     preserveAspectRatio: false,
   *
   *   // a value of 'none' will limit the resize rect to a minimum of 0x0
   *   // 'negate' will allow the rect to have negative width/height
   *   // 'reposition' will keep the width/height positive by swapping
   *   // the top and bottom edges and/or swapping the left and right edges
   *   invert: 'none' || 'negate' || 'reposition'
   *
   *   // limit multiple resizes.
   *   // See the explanation in the {@link Interactable.draggable} example
   *   max: Infinity,
   *   maxPerElement: 1,
   * });
   *
   * var isResizeable = interact(element).resizable();
   * ```
   *
   * Gets or sets whether resize actions can be performed on the target
   *
   * @param {boolean | object} [options] true/false or An object with event
   * listeners to be fired on resize events (object makes the Interactable
   * resizable)
   * @return {boolean | Interactable} A boolean indicating if this can be the
   * target of resize elements, or this Interactable
   */
  Interactable.prototype.resizable = function (this: Interact.Interactable, options) {
    return resizable(this, options, scope)
  }

  actions.resize = resize
  actions.names.push('resize')
  utils.arr.merge(actions.eventTypes, [
    'resizestart',
    'resizemove',
    'resizeinertiastart',
    'resizeresume',
    'resizeend',
  ])
  actions.methodDict.resize = 'resizable'

  defaults.actions.resize = resize.defaults
}

const resize = {
  install,
  defaults: {
    square: false,
    preserveAspectRatio: false,
    axis: 'xy',

    // use default margin
    margin: NaN,

    // object with props left, right, top, bottom which are
    // true/false values to resize when the pointer is over that edge,
    // CSS selectors to match the handles for each direction
    // or the Elements for each handle
    edges: null,

    // a value of 'none' will limit the resize rect to a minimum of 0x0
    // 'negate' will alow the rect to have negative width/height
    // 'reposition' will keep the width/height positive by swapping
    // the top and bottom edges and/or swapping the left and right edges
    invert: 'none',
  } as Interact.ResizableOptions,

  checker (
    _pointer: Interact.PointerType,
    _event: Interact.PointerEventType,
    interactable: Interact.Interactable,
    element: Element,
    interaction: Interaction,
    rect: Interact.Rect
  ) {
    if (!rect) { return null }

    const page = utils.extend({}, interaction.coords.cur.page)
    const options = interactable.options

    if (options.resize.enabled) {
      const resizeOptions = options.resize
      const resizeEdges: { [edge: string]: boolean } = { left: false, right: false, top: false, bottom: false }

      // if using resize.edges
      if (utils.is.object(resizeOptions.edges)) {
        for (const edge in resizeEdges) {
          resizeEdges[edge] = checkResizeEdge(edge,
            resizeOptions.edges[edge],
            page,
            interaction._latestPointer.eventTarget,
            element,
            rect,
            resizeOptions.margin || this.defaultMargin)
        }

        resizeEdges.left = resizeEdges.left && !resizeEdges.right
        resizeEdges.top  = resizeEdges.top  && !resizeEdges.bottom

        if (resizeEdges.left || resizeEdges.right || resizeEdges.top || resizeEdges.bottom) {
          return {
            name: 'resize',
            edges: resizeEdges,
          }
        }
      }
      else {
        const right  = options.resize.axis !== 'y' && page.x > (rect.right  - this.defaultMargin)
        const bottom = options.resize.axis !== 'x' && page.y > (rect.bottom - this.defaultMargin)

        if (right || bottom) {
          return {
            name: 'resize',
            axes: (right ? 'x' : '') + (bottom ? 'y' : ''),
          }
        }
      }
    }

    return null
  },

  cursors: null as unknown as ReturnType<typeof initCursors>,

  getCursor (action: Action) {
    const cursors = resize.cursors as { [key: string]: string }
    if (action.axis) {
      return cursors[action.name + action.axis]
    }
    else if (action.edges) {
      let cursorKey = ''
      const edgeNames = ['top', 'bottom', 'left', 'right']

      for (let i = 0; i < 4; i++) {
        if (action.edges[edgeNames[i]]) {
          cursorKey += edgeNames[i]
        }
      }

      return cursors[cursorKey]
    }

    return null
  },

  defaultMargin: null as unknown as number,
}

function resizable (interactable: Interact.Interactable, options: Interact.Options, scope: Scope) {
  if (utils.is.object(options)) {
    interactable.options.resize.enabled = options.enabled !== false
    interactable.setPerAction('resize', options)
    interactable.setOnEvents('resize', options)

    if (/^x$|^y$|^xy$/.test(options.axis)) {
      interactable.options.resize.axis = options.axis
    }
    else if (options.axis === null) {
      interactable.options.resize.axis = scope.defaults.actions.resize.axis
    }

    if (utils.is.bool(options.preserveAspectRatio)) {
      interactable.options.resize.preserveAspectRatio = options.preserveAspectRatio
    }
    else if (utils.is.bool(options.square)) {
      interactable.options.resize.square = options.square
    }

    return interactable
  }
  if (utils.is.bool(options)) {
    interactable.options.resize.enabled = options

    return interactable
  }
  return interactable.options.resize
}

function checkResizeEdge (name: string, value: any, page: Interact.Point, element: Node, interactableElement: Element, rect: Interact.Rect, margin: number) {
  // false, '', undefined, null
  if (!value) { return false }

  // true value, use pointer coords and element rect
  if (value === true) {
    // if dimensions are negative, "switch" edges
    const width  = utils.is.number(rect.width) ? rect.width  : rect.right  - rect.left
    const height = utils.is.number(rect.height) ? rect.height : rect.bottom - rect.top

    // don't use margin greater than half the relevent dimension
    margin = Math.min(margin, (name === 'left' || name === 'right' ? width : height) / 2)

    if (width < 0) {
      if      (name === 'left')  { name = 'right' }
      else if (name === 'right') { name = 'left'  }
    }
    if (height < 0) {
      if      (name === 'top')    { name = 'bottom' }
      else if (name === 'bottom') { name = 'top'    }
    }

    if (name === 'left') { return page.x < ((width  >= 0 ? rect.left : rect.right) + margin) }
    if (name === 'top') { return page.y < ((height >= 0 ? rect.top : rect.bottom) + margin) }

    if (name === 'right') { return page.x > ((width  >= 0 ? rect.right : rect.left) - margin) }
    if (name === 'bottom') { return page.y > ((height >= 0 ? rect.bottom : rect.top) - margin) }
  }

  // the remaining checks require an element
  if (!utils.is.element(element)) { return false }

  return utils.is.element(value)
  // the value is an element to use as a resize handle
    ? value === element
    // otherwise check if element matches value as selector
    : utils.dom.matchesUpTo(element, value, interactableElement)
}

function initCursors (browser: typeof import('@interactjs/utils/browser').default) {
  return (browser.isIe9 ? {
    x : 'e-resize',
    y : 's-resize',
    xy: 'se-resize',

    top        : 'n-resize',
    left       : 'w-resize',
    bottom     : 's-resize',
    right      : 'e-resize',
    topleft    : 'se-resize',
    bottomright: 'se-resize',
    topright   : 'ne-resize',
    bottomleft : 'ne-resize',
  } : {
    x : 'ew-resize',
    y : 'ns-resize',
    xy: 'nwse-resize',

    top        : 'ns-resize',
    left       : 'ew-resize',
    bottom     : 'ns-resize',
    right      : 'ew-resize',
    topleft    : 'nwse-resize',
    bottomright: 'nwse-resize',
    topright   : 'nesw-resize',
    bottomleft : 'nesw-resize',
  })
}

function start ({ iEvent, interaction }) {
  if (interaction.prepared.name !== 'resize' || !interaction.prepared.edges) {
    return
  }

  const rect = interaction.rect

  interaction.resizeRects = {
    start     : utils.extend({}, rect),
    current   : rect,
    inverted  : utils.extend({}, rect),
    previous  : utils.extend({}, rect),
    delta     : {
      left: 0,
      right : 0,
      width : 0,
      top : 0,
      bottom: 0,
      height: 0,
    },
  }

  iEvent.rect = interaction.resizeRects.inverted
  iEvent.deltaRect = interaction.resizeRects.delta
}

function move ({ iEvent, interaction }) {
  if (interaction.prepared.name !== 'resize' || !interaction.prepared.edges) { return }

  const resizeOptions = interaction.target.options.resize
  const invert = resizeOptions.invert
  const invertible = invert === 'reposition' || invert === 'negate'

  // eslint-disable-next-line no-shadow
  const start      = interaction.resizeRects.start
  const current    = interaction.resizeRects.current
  const inverted   = interaction.resizeRects.inverted
  const deltaRect  = interaction.resizeRects.delta
  const previous   = utils.extend(interaction.resizeRects.previous, inverted)

  if (invertible) {
    // if invertible, copy the current rect
    utils.extend(inverted, current)

    if (invert === 'reposition') {
      // swap edge values if necessary to keep width/height positive

      if (inverted.top > inverted.bottom) {
        const swap = inverted.top

        inverted.top = inverted.bottom
        inverted.bottom = swap
      }
      if (inverted.left > inverted.right) {
        const swap = inverted.left

        inverted.left = inverted.right
        inverted.right = swap
      }
    }
  }
  else {
    // if not invertible, restrict to minimum of 0x0 rect
    inverted.top    = Math.min(current.top, start.bottom)
    inverted.bottom = Math.max(current.bottom, start.top)
    inverted.left   = Math.min(current.left, start.right)
    inverted.right  = Math.max(current.right, start.left)
  }

  inverted.width  = inverted.right  - inverted.left
  inverted.height = inverted.bottom - inverted.top

  for (const edge in inverted) {
    deltaRect[edge] = inverted[edge] - previous[edge]
  }

  iEvent.edges = interaction.prepared.edges
  iEvent.rect = inverted
  iEvent.deltaRect = deltaRect
}

function updateEventAxes ({ interaction, iEvent, action }) {
  if (action !== 'resize' || !interaction.resizeAxes) { return }

  const options = interaction.target.options

  if (options.resize.square) {
    if (interaction.resizeAxes === 'y') {
      iEvent.delta.x = iEvent.delta.y
    }
    else {
      iEvent.delta.y = iEvent.delta.x
    }
    iEvent.axes = 'xy'
  }
  else {
    iEvent.axes = interaction.resizeAxes

    if (interaction.resizeAxes === 'x') {
      iEvent.delta.y = 0
    }
    else if (interaction.resizeAxes === 'y') {
      iEvent.delta.x = 0
    }
  }
}

export default resize
