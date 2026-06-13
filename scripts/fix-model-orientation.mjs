import { NodeIO } from '@gltf-transform/core'
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions'
import path from 'path'

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS)
const modelFile = process.argv[2] ?? 'a321.glb'
const inputPath = path.resolve('public/models/aircraft', modelFile)
const outputPath = inputPath

const document = await io.read(inputPath)
const scene = document.getRoot().listScenes()[0]
let children = [...scene.listChildren()]

// Strip any prior orientation-fix wrapper so rotation is not applied twice.
const existingFix = children.find((n) => n.getName() === 'cesium-orientation-fix')
if (existingFix) {
  const inner = [...existingFix.listChildren()]
  scene.removeChild(existingFix)
  children = inner
  for (const child of children) {
    scene.addChild(child)
  }
}

// Research finding: Y_UP_Transform subtree has nose at -Z, tail at +Z.
// Cesium expects model +X as forward at heading 0 (north).
// Rotation -90° about Y maps -Z → +X.
const theta = -Math.PI / 2
const rotation = [0, Math.sin(theta / 2), 0, Math.cos(theta / 2)]

const wrapper = document.createNode('cesium-orientation-fix')
wrapper.setRotation(rotation)

for (const child of children) {
  scene.removeChild(child)
  wrapper.addChild(child)
}
scene.addChild(wrapper)

await io.write(outputPath, document)
console.log('Written to', outputPath)
console.log('Applied rotation: -90° about Y (nose -Z → +X)')
