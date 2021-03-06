import InteractEvent from '@interactjs/core/InteractEvent'
import { Scope } from '@interactjs/core/scope'
import * as utils from '@interactjs/utils'

export type GesturableMethod = (options?: Interact.GesturableOptions | boolean) => Interact.Interactable | Interact.GesturableOptions

function install (scope: Scope) {
  const {
    actions,
    Interactable,
    interactions,
    defaults,
  } = scope

  /**
   * ```js
   * interact(element).gesturable({
   *     onstart: function (event) {},
   *     onmove : function (event) {},
   *     onend  : function (event) {},
   *
   *     // limit multiple gestures.
   *     // See the explanation in {@link Interactable.draggable} example
   *     max: Infinity,
   *     maxPerElement: 1,
   * });
   *
   * var isGestureable = interact(element).gesturable();
   * ```
   *
   * Gets or sets whether multitouch gestures can be performed on the target
   *
   * @param {boolean | object} [options] true/false or An object with event
   * listeners to be fired on gesture events (makes the Interactable gesturable)
   * @return {boolean | Interactable} A boolean indicating if this can be the
   * target of gesture events, or this Interactable
   */
  Interactable.prototype.gesturable = function (this: Interact.Interactable, options: Interact.GesturableOptions | boolean) {
    if (utils.is.object(options)) {
      this.options.gesture.enabled = options.enabled !== false
      this.setPerAction('gesture', options)
      this.setOnEvents('gesture', options)

      return this
    }

    if (utils.is.bool(options)) {
      this.options.gesture.enabled = options

      return this
    }

    return this.options.gesture as Interact.Options
  }

  interactions.signals.on('action-start', updateGestureProps)
  interactions.signals.on('action-move', updateGestureProps)
  interactions.signals.on('action-end', updateGestureProps)

  interactions.signals.on('action-start', start)
  interactions.signals.on('action-move', move)

  interactions.signals.on('new', (interaction) => {
    interaction.gesture = {
      start: { x: 0, y: 0 },

      startDistance: 0,   // distance between two touches of touchStart
      prevDistance : 0,
      distance     : 0,

      scale: 1,           // gesture.distance / gesture.startDistance

      startAngle: 0,      // angle of line joining two touches
      prevAngle : 0,      // angle of the previous gesture event
    }
  })

  actions.gesture = gesture
  actions.names.push('gesture')
  utils.arr.merge(actions.eventTypes, [
    'gesturestart',
    'gesturemove',
    'gestureend',
  ])
  actions.methodDict.gesture = 'gesturable'

  defaults.actions.gesture = gesture.defaults
}

const gesture = {
  install,
  defaults: {
  },

  checker (_pointer, _event, _interactable, _element, interaction: { pointers: { length: number; }; }) {
    if (interaction.pointers.length >= 2) {
      return { name: 'gesture' }
    }

    return null
  },

  getCursor () {
    return ''
  },
}

function start ({ iEvent, interaction }) {
  if (interaction.prepared.name !== 'gesture') { return }

  iEvent.ds = 0

  interaction.gesture.startDistance = interaction.gesture.prevDistance = iEvent.distance
  interaction.gesture.startAngle = interaction.gesture.prevAngle = iEvent.angle
  interaction.gesture.scale = 1
}

function move ({ iEvent, interaction }) {
  if (interaction.prepared.name !== 'gesture') { return }

  iEvent.ds = iEvent.scale - interaction.gesture.scale

  interaction.target.fire(iEvent)

  interaction.gesture.prevAngle = iEvent.angle
  interaction.gesture.prevDistance = iEvent.distance

  if (iEvent.scale !== Infinity &&
      iEvent.scale !== null &&
      iEvent.scale !== undefined &&
      !isNaN(iEvent.scale)) {
    interaction.gesture.scale = iEvent.scale
  }
}

function updateGestureProps ({ interaction, iEvent, event, phase }) {
  if (interaction.prepared.name !== 'gesture') { return }

  const pointers = interaction.pointers.map((p) => p.pointer)
  const starting = phase === 'start'
  const ending = phase === 'end'
  const deltaSource = interaction.target.options.deltaSource

  iEvent.touches = [pointers[0].pointer, pointers[1].pointer]

  if (starting) {
    iEvent.distance = utils.pointer.touchDistance(pointers, deltaSource)
    iEvent.box      = utils.pointer.touchBBox(pointers)
    iEvent.scale    = 1
    iEvent.ds       = 0
    iEvent.angle    = utils.pointer.touchAngle(pointers, deltaSource)
    iEvent.da       = 0
  }
  else if (ending || event instanceof InteractEvent) {
    iEvent.distance = interaction.prevEvent.distance
    iEvent.box      = interaction.prevEvent.box
    iEvent.scale    = interaction.prevEvent.scale
    iEvent.ds       = iEvent.scale - 1
    iEvent.angle    = interaction.prevEvent.angle
    iEvent.da       = iEvent.angle - interaction.gesture.startAngle
  }
  else {
    iEvent.distance = utils.pointer.touchDistance(pointers, deltaSource)
    iEvent.box      = utils.pointer.touchBBox(pointers)
    iEvent.scale    = iEvent.distance / interaction.gesture.startDistance
    iEvent.angle    = utils.pointer.touchAngle(pointers, deltaSource)

    iEvent.ds = iEvent.scale - interaction.gesture.prevScale
    iEvent.da = iEvent.angle - interaction.gesture.prevAngle
  }
}

export default gesture
