// Self-hosted from npm instead of next/font/google: that one downloads the files
// from fonts.gstatic.com during `next build`, and any network hiccup there fails
// the whole build ("next/font/google queries have exactly one entry").
// Each package ships every subset with its unicode-range, so the browser still
// only fetches the ones a page needs (latin-ext for Polish, etc.).
// The --font-* variables pointing at these families are set on :root in CSS.
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/700.css";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/playfair-display/wght.css";
import "@fontsource-variable/josefin-sans/wght.css";
