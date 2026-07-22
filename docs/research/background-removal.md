# Browser-only background removal

Research date: 2026-07-22. Sources are official repositories, model cards,
papers, and runtime documentation. The research preceded the implementation
described below.

## Recommendation

This is a **moderately easy mini-app**, not a research project. A convincing
single-image prototype is roughly one or two focused days once the model is
chosen. A production-quality browser implementation—worker isolation,
cancellation, first-use download progress, offline/cache states, WebGPU-to-WASM
fallback, memory limits, and a real browser/device test matrix—is more like four
to seven focused days. The hard part is choosing a model whose quality, weight
license, download size, and browser behavior all hold up; decoding a photo,
putting the predicted mask into a canvas alpha channel, and exporting PNG are
straightforward.

There are two coherent paths:

1. **Simplest polished path: `@imgly/background-removal`.** It already provides
   a browser API, ONNX Runtime integration, progress reporting, CPU/GPU choices,
   model selection, rescaling, and worker proxying. Its quantized IS-Net model is
   42.3 MB and its FP16 model is 84.1 MB. The catch is decisive: the library is
   AGPL-3.0, while this repository currently has no declared license. Adopting it
   should therefore be treated as a repository-level licensing decision, not a
   harmless dependency addition. ([official repository and license](https://github.com/imgly/background-removal-js),
   [configuration schema](https://github.com/imgly/background-removal-js/blob/main/packages/web/src/schema.ts),
   [42.3 MB quantized model](https://github.com/imgly/background-removal-js/blob/main/bundle/models/isnet_quint8),
   [84.1 MB FP16 model](https://github.com/imgly/background-removal-js/blob/main/bundle/models/isnet_fp16))
2. **Recommended permissive-license path: Transformers.js + a pinned ONNX
   model, starting with BiRefNet_lite.** Use `@huggingface/transformers`
   (Apache-2.0), which wraps ONNX Runtime Web, supplies a first-class
   `background-removal` pipeline and model processors, and already has an
   official in-browser background-removal example. Run WebGPU first and recreate
   the pipeline with WASM after any adapter, session, or first-inference failure.
   ([Transformers.js license](https://github.com/huggingface/transformers.js/blob/main/LICENSE),
   [pipeline API](https://huggingface.co/docs/transformers.js/api/pipelines),
   [official WebGPU example](https://github.com/huggingface/transformers.js-examples/tree/main/remove-background-webgpu),
   [WebGPU guidance](https://huggingface.co/docs/transformers.js/guides/webgpu))

The second path is my recommendation for e7g.eu, but it has one release gate:
the BiRefNet repository is MIT and publishes the ONNX exports, while the separate
`BiRefNet_lite` model card does not currently declare license metadata. Before
shipping those weights, get an explicit confirmation from the maintainer or use
a model with an unambiguous weight license. BEN2 Base (MIT) is the best general
fallback for licensing clarity, though its 223 MB ONNX payload is less friendly.
MODNet (Apache-2.0, 6.63–25.9 MB ONNX variants) is the excellent lightweight
fallback if the product is explicitly limited to portraits. ([BiRefNet repository](https://github.com/ZhengPeng7/BiRefNet),
[BiRefNet_lite card](https://huggingface.co/ZhengPeng7/BiRefNet_lite),
[BEN2 card](https://huggingface.co/PramaLLC/BEN2),
[MODNet license scope](https://github.com/ZHKKKe/MODNet#license),
[web-ready MODNet files](https://huggingface.co/Xenova/modnet/tree/main/onnx))

**Implementation correction:** the chosen U²-NetP repository advertises a
Transformers.js snippet, but Transformers.js 4.2 rejects its `u2net` model type
before creating an ONNX session. For this specific tiny model, direct
`onnxruntime-web` is both compatible and simpler: the app owns the fixed 320²
preprocessing and alpha-mask conversion without a general model registry.

## Model comparison

| Model                            | Generality and quality position                                                                                                                                                                                                                                   | Weight/download facts                                                                                                                                                       | License assessment                                                                                                                                                                                    | Browser fit                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BiRefNet_lite**                | Modern general-object dichotomous segmentation; the strongest quality/size candidate found. Its Swin-T result trails full BiRefNet but is much smaller.                                                                                                           | 44.4M parameters, 178 MB FP32 weights, normally 1024×1024 input. The official repository also publishes ONNX conversions.                                                   | Repository: MIT. Separate lite model card: no explicit license metadata; resolve this before distribution.                                                                                            | Plausible, but requires an actual ORT WebGPU/WASM compatibility and mobile-memory spike. Quantizing the official ONNX should be quality-tested, not assumed safe. ([official model](https://huggingface.co/ZhengPeng7/BiRefNet_lite/tree/main), [official model zoo and ONNX notes](https://github.com/ZhengPeng7/BiRefNet#model-zoo))                                                 |
| **BiRefNet full / HR / matting** | The strongest permissive-family quality option, including specialized high-resolution and soft-matting weights.                                                                                                                                                   | Standard checkpoint is about 445 MB. The authors report 3.5 GB FP16 inference memory and 57.7 ms at 1024² on an RTX 4090; their ONNX export is slower than PyTorch on A100. | MIT repository/model card.                                                                                                                                                                            | Too heavy as the default consumer-PWA payload. Useful as an offline desktop benchmark, not the first browser release. ([official repository efficiency and ONNX notes](https://github.com/ZhengPeng7/BiRefNet#model-zoo), [official files](https://huggingface.co/ZhengPeng7/BiRefNet/tree/main))                                                                                      |
| **BEN2 Base**                    | General-object model emphasizing hair, edges, high-resolution processing, and foreground refinement. Its own card says the commercial “full” model is better, so only Base is under consideration.                                                                | 94.6M parameters; official ONNX is 223 MB and uses 1024² input.                                                                                                             | Base model card: MIT. Training used DIS5K plus a proprietary 22k-image set; proprietary training data does not by itself negate the released weight license, but provenance should remain documented. | Viable direct ORT fallback after an operator-compatibility spike; large for mobile and first-use download. ([official card](https://huggingface.co/PramaLLC/BEN2), [official files](https://huggingface.co/PramaLLC/BEN2/tree/main), [official ONNX runner](https://huggingface.co/PramaLLC/BEN2/blob/main/onnx_run.py))                                                               |
| **MODNet**                       | Purpose-built trimap-free **portrait** matting. It produces a soft alpha matte and is fast, but it is not a general product/object remover. The authors document semantic failures under difficult lighting, similar foreground/background, distance, and motion. | Web-ready ONNX: 25.9 MB FP32, 13 MB FP16, 11.8 MB q4f16, or 6.63 MB q8/uint8. Reference preprocessing resizes the shortest edge to 512 with dimensions divisible by 32.     | Official repository explicitly licenses code, models, and demos under Apache-2.0 (except demo GIFs).                                                                                                  | Best low-risk browser option for people. It is already used by Hugging Face's official WebGPU demo and Transformers.js processor. ([official repository](https://github.com/ZHKKKe/MODNet), [documented limitations](https://github.com/ZHKKKe/MODNet/blob/master/demo/video_matting/webcam/README.md), [official web conversion and processor](https://huggingface.co/Xenova/modnet)) |
| **U²-Net / U2NetP**              | Older salient-object segmentation baseline from 2020, not a modern fine matting model. Expect weaker hair, fur, translucent edges, thin structures, and ambiguous multi-object scenes.                                                                            | Full model 176.3 MB; U2NetP 4.7 MB; pretrained inference uses 320². The paper reports 30/40 FPS respectively on GTX 1080 Ti.                                                | Official repository: Apache-2.0. `rembg`, a popular MIT Python wrapper, is useful for comparison but is not browser architecture.                                                                     | Easiest tiny general-object baseline. U2NetP is a viable “works everywhere” fallback only if the quality bar tolerates its age. ([official repository](https://github.com/xuebinqin/U-2-Net), [official paper](https://arxiv.org/abs/2005.09007), [`rembg`](https://github.com/danielgatis/rembg))                                                                                     |
| **IMG.LY IS-Net wrapper**        | Mature, polished integration around general background removal; likely the shortest path to a good UX, though not the newest model family.                                                                                                                        | 42.3 MB uint8, 84.1 MB FP16, 168 MB FP32.                                                                                                                                   | Library: AGPL-3.0. The dependency is FOSS, but strong copyleft is a product/repository licensing constraint.                                                                                          | Excellent integration fit if the project deliberately accepts AGPL and publishes compliant source. ([official repository](https://github.com/imgly/background-removal-js), [bundled model files](https://github.com/imgly/background-removal-js/tree/main/bundle/models))                                                                                                              |

### Models to reject under “FOSS only”

- **BRIA RMBG-1.4 and RMBG-2.0:** technically attractive and shown in
  Transformers.js examples, but the weights are restricted to non-commercial
  use and require a commercial agreement otherwise. RMBG-2.0 is also roughly
  885 MB FP32 / 0.2B parameters. “Source available” is not the requested FOSS
  condition. ([RMBG-1.4 card](https://huggingface.co/briaai/RMBG-1.4),
  [RMBG-2.0 card and license](https://huggingface.co/briaai/RMBG-2.0),
  [RMBG-2.0 files](https://huggingface.co/briaai/RMBG-2.0/tree/main))
- **withoutBG Open Model:** its combined artifact is not simply Apache-2.0; the
  canonical license says `Apache-2.0 AND LicenseRef-DINOv3`, and the roughly
  495 MB FP32 payload is poor for this PWA. ([official model card](https://huggingface.co/withoutbg/withoutbg-openweights-onnx),
  [canonical license](https://withoutbg.com/open-model/license))

Vendor/model-card examples are not an apples-to-apples benchmark. A final
decision needs an e7g-owned test set covering hair and fur, translucent objects,
thin wires, low contrast, multiple subjects, products, illustrations, and text.
Compare soft-alpha composites over black, white, and saturated backgrounds;
halos and missing detail matter more to users than a single segmentation score.

## Browser architecture

### Runtime

Use a lazily imported, client-only module with a dedicated module Worker:

1. Decode and orient the selected image to an `ImageBitmap`.
2. Transfer a resized inference copy to the worker. Never infer at the original
   12–48 MP camera resolution; use the model's processor/input size.
3. For U²-NetP, create a direct ONNX Runtime Web session with the universal WASM
   execution provider. Feed the fixed `input.1` tensor and request only the
   composite foreground output `1959`. ([ORT execution-provider configuration](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html))
4. Resize the predicted single-channel mask to original dimensions, write it to
   the original canvas alpha channel, and export PNG. Hugging Face's official
   example implements exactly this flow for MODNet. ([example source](https://github.com/huggingface/transformers.js-examples/blob/main/remove-background-webgpu/src/App.jsx))
5. Serialize jobs and return a `Blob`; cancel queued work and dispose the model,
   tensors, `ImageBitmap`s, object URLs, and canvases on route teardown.

Direct ORT is the appropriate seam for U²-NetP because its preprocessing is
small and fixed while the generic Transformers.js model registry does not
support the architecture. ORT documents WebGPU, WASM, WebGL, and WebNN
providers, recommends WASM for lightweight/universal CPU execution, and warns
that GPU providers cover only subsets of ONNX operators. ([ORT web overview](https://onnxruntime.ai/docs/tutorials/web/),
[ORT license](https://github.com/microsoft/onnxruntime/blob/main/LICENSE))

WebGPU is now broadly available across current Chromium, Safari, and desktop
Firefox implementations, but support is still uneven on Linux and mobile
Firefox. It also requires a secure context. WASM must remain a supported normal
state, not an error screen; WebGL is in maintenance mode and should not be the
primary fallback. ([GPUWeb implementation status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status),
[ORT deployment requirements](https://onnxruntime.ai/docs/tutorials/web/deploy.html),
[ORT performance guidance](https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html))

WASM multithreading requires cross-origin isolation. Without COOP/COEP the app
still works but uses single-threaded WASM; enabling isolation is a deployment
decision because it constrains cross-origin resources. An explicit Worker is
still useful for responsiveness and supports both WebGPU and WASM, whereas
ORT's simpler proxy worker cannot be combined with WebGPU. ([ORT environment
flags](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html))

### Model delivery, caching, and offline behavior

Self-host immutable, version-pinned model and runtime assets rather than relying
on a third-party CDN. Fetch the model explicitly after consent so the app owns
progress reporting and passes the resulting bytes directly to the ONNX session.

There is a repo-specific trap: `apps/web/src/service-worker.ts` precaches every
SvelteKit `build` and `files` entry with `cache.addAll`. Placing a 42–223 MB model
under `static` would therefore force **every visitor** to download it during
service-worker installation, even if they never open the mini-app. Before
shipping, exclude model/runtime assets from the app-shell precache and fetch
them on first use into one deliberate runtime cache. Avoid having both the
service worker and the browser HTTP cache duplicate copies. The normal UI states
must include “model not downloaded,” download progress and size, offline before
first download, cache eviction, and retry.

The implemented network boundary is deliberately narrower:

- Opening the route loads only the ordinary same-origin page assets. It does not
  construct the AI worker or request a model or runtime.
- Clicking the explicit consent button loads the lazy background-removal worker
  and the 4.4 MiB same-origin `/ai/u2netp/onnx/model.onnx`.
- The same click permits the roughly 13 MiB same-origin ONNX WASM runtime from
  `/ai/runtime/`. Chromium also requests its roughly 24 KiB JavaScript loader;
  Firefox uses the loader already bundled into the consent-gated worker.
- Remote models are disabled. There are no Hugging Face, CDN, analytics, or API
  requests, and `/ai/` is excluded from the PWA app-shell precache.

### Memory and product limits

A 12 MP RGBA canvas alone is about 48 MB. Source decode, output canvas, resized
input, mask, tensors, and GPU/CPU copies can multiply peak memory, especially on
iOS. Process one image at a time; cap input/output megapixels; infer only at the
model resolution; composite once at original or capped export size; revoke URLs;
close bitmaps; and release canvas backing stores. ORT can avoid CPU/GPU copies
with I/O binding, but for one-shot images that complexity should wait for a
profile demonstrating need. ([ORT WebGPU I/O binding](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html))

## Fit with the existing codebase

The route can remain a self-contained mini-app, matching the existing product
seam. The image compressor already supplies reusable **patterns**, though not
necessarily shared modules yet: file/drop handling, EXIF-aware
`createImageBitmap`, canvas export, object-URL cleanup, image dimension limits,
busy/error states, before/after previews, and download naming. Reuse those
interaction and cleanup conventions; deepen shared image code only if both
routes genuinely need the same public behavior.

A focused first release should do one thing well: choose/drop one image, show
first-use model download progress, remove the background, compare original and
transparent result on a checkerboard, and download PNG. Batch ZIPs, live camera,
manual brush correction, background replacement, and multiple model choices are
separate product decisions. Manual edge correction is the first likely follow-up
if evaluation shows that no small browser model is consistently trustworthy.

## Decision gates before implementation

1. Decide whether e7g.eu will adopt an explicit repository license compatible
   with AGPL. If yes, benchmark IMG.LY first because it is the lowest engineering
   risk. If no, choose the permissive Transformers.js path.
2. Get explicit confirmation that BiRefNet_lite weights are MIT-covered, or use
   MIT BEN2 Base / Apache-2.0 MODNet within its portrait scope.
3. Run a throwaway compatibility benchmark—not production code—across Chrome,
   Safari, Firefox, Android Chrome, and iPhone Safari, recording first download,
   cold/warm model initialization, inference, peak memory/crashes, output quality,
   WebGPU success, and WASM fallback.
4. Compare BiRefNet_lite against BEN2 Base, MODNet portraits, and U2NetP on the
   same private evaluation corpus; keep every candidate and evaluation tool FOSS.
5. Change model caching/precache policy before putting any weight file under the
   deployed static tree.
