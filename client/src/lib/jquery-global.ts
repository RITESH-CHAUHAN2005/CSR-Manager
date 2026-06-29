// Expose jQuery on window so the jQuery plugin Select2 can attach to `$.fn`.
// This module MUST be imported before `import 'select2'` so the plugin finds jQuery.
import jQuery from 'jquery'

const w = window as unknown as { $?: typeof jQuery; jQuery?: typeof jQuery }
w.$ = jQuery
w.jQuery = jQuery

export default jQuery
