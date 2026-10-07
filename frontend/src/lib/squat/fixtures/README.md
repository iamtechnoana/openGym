# Squat fixtures

Landmark recordings of real squat sets for `../fixtures.test.js`. No video belongs here.

1. Film a set from the side, phone at hip height, whole body in the picture.
2. `npm run dev`, open `/#/dev/pose-extract`, pick the video; a `.json` downloads.
3. In that file set `expected.reps` and, per faulty rep number, its faults:
   `"expected": { "reps": 8, "faults": { "3": ["shallow"], "7": ["lean"] } }`
4. Save it here and run `npx vitest run src/lib/squat/fixtures.test.js`.
