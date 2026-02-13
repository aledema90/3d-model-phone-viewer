// 3D Phone Viewer - Three.js Application
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

let scene, camera, renderer, controls, currentModel;
let animationId;
let backgroundMesh = null;

// DOM Elements
const canvas = document.getElementById('canvas3d');
const viewerContainer = document.getElementById('viewerContainer');
const phoneFrame = document.getElementById('phoneFrame');
const modelInput = document.getElementById('modelInput');
const deviceSelect = document.getElementById('deviceSelect');
const bgColorInput = document.getElementById('bgColor');
const fileNameSpan = document.getElementById('fileName');
const loadingOverlay = document.getElementById('loadingOverlay');
const dropZone = document.getElementById('dropZone');
const bgMeshInput = document.getElementById('bgMeshInput');
const bgMeshFileName = document.getElementById('bgMeshFileName');
const bgMeshVisible = document.getElementById('bgMeshVisible');
const removeBgMeshBtn = document.getElementById('removeBgMesh');

// Initialize Three.js scene
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera - positioned for frontal full-body view
    const container = viewerContainer.getBoundingClientRect();
    camera = new THREE.PerspectiveCamera(40, container.width / container.height, 0.1, 1000);
    camera.position.set(0, 0.5, 4);

    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        antialias: true,
        alpha: true 
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.width, container.height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Orbit Controls
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 20;
    controls.target.set(0, 0.3, 0);

    // Lighting
    setupLighting();

    // Start animation loop
    animate();

    // Set initial device size
    updateDeviceSize(deviceSelect.value);
}

// Light references for dynamic control
let ambientLight, mainLight, fillLight, rimLight, hemiLight;

function setupLighting() {
    // Ambient light
    ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Main directional light
    mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    // Fill light
    fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    // Rim light
    rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, -5, -5);
    scene.add(rimLight);

    // Hemisphere light for ambient fill
    hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // Setup lighting control sliders
    setupLightingControls();
}

function setupLightingControls() {
    // Main light intensity
    const mainSlider = document.getElementById('mainSlider');
    const mainValue = document.getElementById('mainValue');
    mainSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        mainLight.intensity = val;
        mainValue.textContent = val.toFixed(1);
    });

    // Fill light intensity
    const fillSlider = document.getElementById('fillSlider');
    const fillValue = document.getElementById('fillValue');
    fillSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        fillLight.intensity = val;
        fillValue.textContent = val.toFixed(1);
    });

    // Rim light intensity
    const rimSlider = document.getElementById('rimSlider');
    const rimValue = document.getElementById('rimValue');
    rimSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        rimLight.intensity = val;
        rimValue.textContent = val.toFixed(1);
    });
}

function animate() {
    animationId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function loadModel(file) {
    showLoading(true);
    hideDropZone();

    const loader = new GLTFLoader();
    
    // Set up Draco decoder for compressed models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);

    const url = URL.createObjectURL(file);

    loader.load(
        url,
        (gltf) => {
            console.log('Model loaded successfully:', gltf);
            
            // Remove existing model
            if (currentModel) {
                scene.remove(currentModel);
                disposeModel(currentModel);
            }

            currentModel = gltf.scene;

            // Auto-scale and center the model
            const box = new THREE.Box3().setFromObject(currentModel);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // Scale to fit in view
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2.2 / maxDim;
            currentModel.scale.setScalar(scale);

            // Center the model horizontally, keep vertical center
            box.setFromObject(currentModel);
            const newCenter = box.getCenter(new THREE.Vector3());
            currentModel.position.x = -newCenter.x;
            currentModel.position.z = -newCenter.z;
            // Keep y centered but offset slightly up
            currentModel.position.y = -newCenter.y + 0.3;

            // Enable shadows
            currentModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(currentModel);

            // Reset camera
            resetCamera();

            // Update file name display
            fileNameSpan.textContent = truncateFileName(file.name);

            showLoading(false);
            URL.revokeObjectURL(url);
        },
        (progress) => {
            if (progress.total) {
                const percent = Math.round((progress.loaded / progress.total) * 100);
                console.log(`Loading: ${percent}%`);
            }
        },
        (error) => {
            console.error('Error loading model:', error);
            showLoading(false);
            showDropZone();
            alert('Error loading model: ' + error.message + '\n\nPlease make sure it\'s a valid GLB/GLTF file.');
        }
    );
}

function disposeModel(model) {
    model.traverse((child) => {
        if (child.isMesh) {
            child.geometry.dispose();
            if (child.material.isMaterial) {
                cleanMaterial(child.material);
            } else if (Array.isArray(child.material)) {
                child.material.forEach(cleanMaterial);
            }
        }
    });
}

function cleanMaterial(material) {
    material.dispose();
    for (const key in material) {
        const value = material[key];
        if (value && typeof value === 'object' && 'dispose' in value) {
            value.dispose();
        }
    }
}

function resetCamera() {
    camera.position.set(0, 0.5, 4);
    controls.target.set(0, 0.3, 0);
    controls.update();
}

function updateDeviceSize(device) {
    phoneFrame.className = 'phone-frame ' + device;
    
    setTimeout(() => {
        const container = viewerContainer.getBoundingClientRect();
        camera.aspect = container.width / container.height;
        camera.updateProjectionMatrix();
        renderer.setSize(container.width, container.height);
    }, 100);
}

function updateBackgroundColor(color) {
    scene.background = new THREE.Color(color);
}

function truncateFileName(name, maxLength = 15) {
    if (name.length <= maxLength) return name;
    const ext = name.slice(name.lastIndexOf('.'));
    const base = name.slice(0, name.lastIndexOf('.'));
    const truncated = base.slice(0, maxLength - ext.length - 3);
    return `${truncated}...${ext}`;
}

function showLoading(show) {
    loadingOverlay.classList.toggle('visible', show);
}

function showDropZone() {
    dropZone.classList.remove('hidden');
}

function hideDropZone() {
    dropZone.classList.add('hidden');
}

// Event Listeners
modelInput.addEventListener('change', (e) => {
    console.log('File input changed!', e.target.files);
    const file = e.target.files[0];
    if (file) {
        console.log('Loading file:', file.name, file.size, 'bytes');
        loadModel(file);
    } else {
        console.log('No file selected');
    }
});

deviceSelect.addEventListener('change', (e) => {
    updateDeviceSize(e.target.value);
});

bgColorInput.addEventListener('input', (e) => {
    updateBackgroundColor(e.target.value);
});

// Drag and drop
viewerContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

viewerContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
});

viewerContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
        loadModel(file);
    } else {
        alert('Please drop a .glb or .gltf file');
    }
});

// Window resize
window.addEventListener('resize', () => {
    const container = viewerContainer.getBoundingClientRect();
    camera.aspect = container.width / container.height;
    camera.updateProjectionMatrix();
    renderer.setSize(container.width, container.height);
});

// Background mesh functions
function loadBackgroundMesh(file) {
    showLoading(true);

    const loader = new GLTFLoader();
    
    // Set up Draco decoder for compressed models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);

    const url = URL.createObjectURL(file);

    loader.load(
        url,
        (gltf) => {
            console.log('Background mesh loaded successfully:', gltf);
            
            // Remove existing background mesh
            if (backgroundMesh) {
                scene.remove(backgroundMesh);
                disposeModel(backgroundMesh);
            }

            backgroundMesh = gltf.scene;

            // Don't auto-scale background - keep original size
            // Position it behind the main model
            backgroundMesh.position.set(0, 0, -5);

            // Enable shadows for background
            backgroundMesh.traverse((child) => {
                if (child.isMesh) {
                    child.receiveShadow = true;
                }
            });

            scene.add(backgroundMesh);

            // Update file name display
            bgMeshFileName.textContent = truncateFileName(file.name);
            bgMeshVisible.checked = true;

            showLoading(false);
            URL.revokeObjectURL(url);
        },
        (progress) => {
            if (progress.total) {
                const percent = Math.round((progress.loaded / progress.total) * 100);
                console.log(`Loading background: ${percent}%`);
            }
        },
        (error) => {
            console.error('Error loading background mesh:', error);
            showLoading(false);
            alert('Error loading background mesh: ' + error.message);
        }
    );
}

function removeBackgroundMesh() {
    if (backgroundMesh) {
        scene.remove(backgroundMesh);
        disposeModel(backgroundMesh);
        backgroundMesh = null;
        bgMeshFileName.textContent = 'No mesh';
        bgMeshVisible.checked = false;
    }
}

function toggleBackgroundMeshVisibility(visible) {
    if (backgroundMesh) {
        backgroundMesh.visible = visible;
    }
}

// Background mesh event listeners
bgMeshInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        loadBackgroundMesh(file);
    }
});

bgMeshVisible.addEventListener('change', (e) => {
    toggleBackgroundMeshVisibility(e.target.checked);
});

removeBgMeshBtn.addEventListener('click', () => {
    removeBackgroundMesh();
});

// Global reset function
window.resetCamera = resetCamera;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('3D Phone Viewer script loaded');
