# MapTiler 3D Models Changelog
### NEXT (3.1.0)


### 3.0.0
## ✨ New Features
- 3D models can now have their pitch and roll changed via convenience methods.

## 🐞 Bug Fixes
- None

## ⚙️ Other


## ✨ New Features
- GLTF Models are now animateable 🎬 🚀
- New `Item3D` class allows for UI events on individual meshes, click, dblclick, mouseenter and mouseleave
- `Item3D` class instances can also have "states" similar to pseudo classes in DOM elements.
- Rather than each Layer3D having their own renderer instance, rendering is now batched and rendered by a single render manager instance making it more efficient and more performant.
- Meshes can now have one-off user-defined transforms applied when they are added to the scene. This can be useful for ensuring all meshes have the same rotation / face the same way, or if they need their world position tweaked without tweaking their LngLat.

### 2.1.0

## ⚙️ Other
- Version bump @maptiler/sdk to 3.5.0
- MaptilerSDK Dep is now tied to minor versions instead of major versions

### 2.0.2
## 🐞 Bug Fixes
- Set default rendering min zoom value to work fine with globe

### 2.0.1
## 🐞 Bug Fixes
- Set default rendering min zoom value to work fine with globe


### 2.0.0
## ✨ New Features
- Globe projection support

## ⚙️ Other
- Using MapTiler SDK JS v3 (globe)

### 1.0.0
First release 🎉
