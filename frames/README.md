# Photo-360 spin frames

Empty by design. When the dealership shoots a real walk-around of a car,
drop the frames here as:

```
frames/<car-id>/001.jpg
frames/<car-id>/002.jpg
...
frames/<car-id>/036.jpg
```

(`<car-id>` matches the `id` field in `assets/js/cars.js`, e.g.
`hyundai-creta-2021`.) 24–36 evenly-spaced frames around the car works well.
`assets/js/spin.js` HEAD-checks for `001.jpg` in a car's folder at runtime —
if it's missing, the spin component hides itself entirely and the page
falls back to the regular photo gallery. Nothing else needs to change.
