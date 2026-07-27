# Toshiba MX2-TT20SC recipe integration notes

This note records the operating constraints used by the recipe generator. It is
an implementation summary, not a replacement for the appliance manual. The
recipe text is newly written and does not reproduce long passages from the
official cookbook.

## Official sources reviewed

- Product page: <https://www.toshiba-lifestyle.com/hk/oven/steam-oven/MX2-TT20SC>
- Official cookbook PDF: <https://www.toshiba-lifestyle.com/content/dam/toshiba-aem/hk/category-page/oven/steam-oven/mx2-tt20sc(wh)/download/MX2-TT20SC-WH-Cook-Book-.pdf>
- Official user manual PDF: <https://www.toshiba-lifestyle.com/content/dam/toshiba-aem/hk/category-page/oven/steam-oven/mx2-tt20sc(wh)/download/MX2-TT20SC-WH-User-Manual.pdf>
- Official catalogue / supplied user document: <https://www.toshiba-lifestyle.com/content/dam/toshiba-aem/hk/category-page/oven/steam-oven/mx2-tt20sc(wh)/download/MX2-TT20SC-WH-Catalogue.pdf>
- Local text extracts used during implementation:
  `tmp/pdfs/mx2-cookbook.txt` and `tmp/pdfs/mx2-manual.txt`

## Manual operating ranges used by the app

| Function | Supported setting used for validation |
|---|---:|
| Microwave | 800 W, 600 W, 500 W, 200 W, 100 W |
| Pure Steam | 50–100°C |
| High-temperature Steam | 110–130°C |
| Steam Bake | 100–230°C |
| Bake | 70–230°C |
| Fermentation | 28–45°C |
| Keep Warm | 60°C |

The product page and the extracted manual are not fully consistent about one
low microwave power value. Recipe data follows the supplied manual's **200 W**
setting, not the product-page value. The current 300 recipes do not depend on a
low-power microwave programme.

## Safety and vessel rules encoded in recipes

- Clean the fresh-water tank before steam cooking and fill it with filtered or
  distilled water below 40°C.
- Pure Steam recipes use a heatproof ceramic dish on the steaming rack at the
  lower level. They use manual temperature and time because the household
  three-person quantity may differ from an Auto Menu's reference weight.
- Steam Bake recipes use the supplied tray at the lower level and explicitly
  state whether preheating and the water tank are required.
- Standard Bake recipes use the supplied tray or a heatproof ceramic baking
  dish on the steaming rack at the lower level.
- The supplied metal baking tray and steaming rack must **not** be used in
  Microwave mode. Microwave-safe ware belongs on the cavity floor plate.
- Microwave cookware must be labelled microwave-safe and have no metal trim,
  cracks or chips. Metal containers and metal ties are excluded.
- Opening instructions warn the cook to stand back from steam and use oven
  gloves around the hot cavity and inner door glass.
- If `F-01` appears when starting a steam programme, the cavity must cool before
  starting again.

## Cookbook observations applied without copying

The cookbook repeatedly places savoury steamed dishes and steam-baked meats on
the lower level. Examples also show that steam-baked meat benefits from a
preheated cavity and a full water tank. Those patterns informed the generated
steps, but each recipe has been rewritten for the app's ingredients, three
servings and manual controls.

Some Auto Menu numbers or descriptions in the supplied material are
inconsistent, notably menus 16, 30 and 34. The generator therefore avoids
hard-coding those menus. It also avoids applying an Auto Menu time when the
recipe weight differs from the official reference portion.

Automatic timings are never treated as proof of doneness. Chicken and duck must
reach 75°C at the thickest point; minced meat must reach 71°C; pork must be
cooked through; seafood must be opaque and unopened clams discarded. Add time
in short increments when the food has not reached its stated doneness check.

## Household equipment scope

Recipe `equipment` metadata is intentionally restricted to:

- frying pan;
- Chinese wok;
- Toshiba MX2-TT20SC;
- the MX2 supplied baking tray or steaming rack;
- heatproof ceramic or microwave-safe dishes used with the MX2.

General preparation items such as knives, chopping boards, mixing bowls and
serving plates are not counted as cooking appliances.
