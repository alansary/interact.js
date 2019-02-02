/* eslint-disable */

/**
 * @module modifiers/aspectRatio
 *
 * @description
 * This module forces elements to be resized with a specified dx/dy ratio.
 *
 * @example
 * interact(target).resizable({
 *   modifiers: [
 *     interact.modifiers.snapSize({
 *       targets: [ interact.createSnapGrid({ x: 20, y: 20 }) ],
 *     }),
 *     interact.aspectRatio({ ratio: 'preserve' }),
 *   ],
 * });
 */

import * as is from '@interactjs/utils/is'
import extend from '@interactjs/utils/extend'

export default {
  start ({ interaction, status, rect, pageCoords }) {
    let { ratio, fix } = status.options

    if (is.func(ratio)) {
      ratio = ratio(interaction)
    }

    if (ratio === 'preserve') {
      ratio = rect.width / rect.height
    }
    else if (ratio === 'square') {
      ratio = 1
      fix = false
    }

    status.startCoords = extend({}, pageCoords)
    status.startRect = extend({}, rect)
    const originalEdges = status.originalEdges = interaction.edges

    status.linkedEdges = interaction.edges = {
      top   : originalEdges.top    || (originalEdges.left   && !originalEdges.bottom),
      left  : originalEdges.left   || (originalEdges.top    && !originalEdges.right),
      bottom: originalEdges.bottom || (originalEdges.right  && !originalEdges.top),
      right : originalEdges.right  || (originalEdges.bottom && !originalEdges.left),
    }
  },

  set ({ status, coords, rect }) {
    const { startCoords, originalEdges, options: { ratio } } = status

    const dx0 = coords.x - startCoords.x
    const dy0 = coords.y - startCoords.y

    const dx = dx0
    const dy = dy0

    const width = rect.right - rect.left
    const height = rect.bottom - rect.top

    debugger

    const primaryAxis = originalEdges.left || originalEdges.right ? 'x'  : 'y'

    if (primaryAxis === 'x') {
    }

    coords.x = startCoords.x + dx
    coords.y = startCoords.y + dy
  },

  defaults: {
    ratio: null,
  },
}
