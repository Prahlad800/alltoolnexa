// Immutable upstream Runno assets. Never replace checksums to accept a failed download.
export const RUNTIME_COMMIT='3c32435e7a07a59aac3f5497040c8c6317d1cff3';
export const RUNTIME_BASE='/vendor/code-runtime/3c32435e';
export const RUNTIME_ASSETS=[
 {name:'clang.wasm',bytes:31214472,sha256:'2a466f0e990329d3230b869d04fc20803eae96a7feb3a3f6c93e25a77b8aed1d'},
 {name:'wasm-ld.wasm',bytes:19490094,sha256:'36419ed202011765222098d7701218378b67f634d50f0a4625059ae2c9860f48'},
 {name:'clang-fs.tar.gz',bytes:1790862,sha256:'7ed12063619882e4dfa710ab371fc91848b256f85a4075747e8bd5c167902b50'},
 {name:'python-3.11.3.wasm',bytes:20538911,sha256:'658cb6add2bbf8dfe84d67fb85430956d5a8b2b1d694d33432d654cdf048f813'},
 {name:'python-3.11.3.tar.gz',bytes:4066590,sha256:'8c42694e45f2f1162114c70507c3da4c7cf983663e2b95660af521a9685d2a0c'},
 {name:'wasmedge_quickjs.wasm',bytes:3974159,sha256:'85922baafd4385bc908d766989948df9ab28f8f0c8afd2ab6b35a4950570d0f6'},
];
export const assetFile=asset=>asset.name.endsWith('.wasm')?asset.name+'.pack':asset.name;
