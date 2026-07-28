/**
 * Subidas optimizadas para móvil: cámara directa + compresión de imágenes.
 */
window.DeseoUploadMobile = (function () {
    const MAX_IMAGE_BYTES = 3.8 * 1024 * 1024;
    const MAX_DIMENSION = 1920;

    function isMobile() {
        return window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;
    }

    function replaceInputFile(input, file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
    }

    function compressImageFile(file, maxBytes, maxDim) {
        const limit = maxBytes || MAX_IMAGE_BYTES;
        const dimension = maxDim || MAX_DIMENSION;

        if (!file || !String(file.type || '').startsWith('image/')) {
            return Promise.resolve(file);
        }
        if (file.size <= limit * 0.92) {
            return Promise.resolve(file);
        }

        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;
                const scale = Math.min(1, dimension / Math.max(width, height, 1));
                width = Math.max(1, Math.round(width * scale));
                height = Math.max(1, Math.round(height * scale));

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                let quality = 0.88;
                const tryBlob = () => {
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                resolve(file);
                                return;
                            }
                            if (blob.size > limit && quality > 0.45) {
                                quality -= 0.08;
                                tryBlob();
                                return;
                            }
                            const baseName = (file.name || 'foto').replace(/\.[^.]+$/, '');
                            resolve(
                                new File([blob], `${baseName}.jpg`, {
                                    type: 'image/jpeg',
                                    lastModified: Date.now()
                                })
                            );
                        },
                        'image/jpeg',
                        quality
                    );
                };
                tryBlob();
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(file);
            };
            img.src = url;
        });
    }

    function captureForRole(role) {
        if (role === 'selfie' || role === 'user') {
            return 'user';
        }
        if (role === 'document' || role === 'video' || role === 'environment') {
            return 'environment';
        }
        return null;
    }

    function hasCustomUploadUi(input) {
        const parent = input.parentElement;
        if (!parent) {
            return false;
        }
        if (parent.querySelector('.file-upload-area')) {
            return true;
        }
        const prev = input.previousElementSibling;
        return Boolean(prev && prev.classList.contains('file-upload-area'));
    }

    function getRole(input) {
        return input.dataset.mobileUpload || input.dataset.mobileCapture || 'file';
    }

    function applyCapture(input) {
        const capture = captureForRole(getRole(input));
        if (capture && isMobile()) {
            input.setAttribute('capture', capture);
        }
    }

    function notifyCustomUi(input) {
        const id = input.id;
        if (id === 'postFile' && typeof window.updateFileInfo === 'function') {
            window.updateFileInfo(input);
        } else if (id === 'bodyVideoFile' && typeof window.updateBodyVideoFileInfo === 'function') {
            window.updateBodyVideoFileInfo(input);
        } else if (id === 'avatarFile' && typeof window.updateAvatarFileInfo === 'function') {
            window.updateAvatarFileInfo(input);
        } else if (id === 'coverFile' && typeof window.updateCoverFileInfo === 'function') {
            window.updateCoverFileInfo(input);
        }
    }

    async function handleFileChange(input, btn, nameEl) {
        const file = input.files && input.files[0];
        if (!file) {
            if (btn) {
                btn.classList.remove('has-file');
            }
            if (nameEl) {
                nameEl.textContent = '';
            }
            return;
        }

        let finalFile = file;
        if (file.type.startsWith('image/')) {
            finalFile = await compressImageFile(file);
            if (finalFile !== file) {
                replaceInputFile(input, finalFile);
            }
        }

        if (btn) {
            btn.classList.add('has-file');
        }
        if (nameEl) {
            const sizeMb = (finalFile.size / (1024 * 1024)).toFixed(2);
            nameEl.textContent = `${finalFile.name} (${sizeMb} MB)`;
        }

        notifyCustomUi(input);
    }

    function enhanceCustomUiInput(input) {
        if (!input || input.dataset.mobileEnhanced === '1') {
            return;
        }
        input.dataset.mobileEnhanced = '1';
        applyCapture(input);
        input.addEventListener('change', () => {
            handleFileChange(input, null, null);
        });
    }

    function wrapFileInput(input) {
        if (!input || input.dataset.mobileWrapped === '1') {
            return;
        }

        if (hasCustomUploadUi(input)) {
            enhanceCustomUiInput(input);
            return;
        }

        input.dataset.mobileWrapped = '1';
        applyCapture(input);

        const role = getRole(input);
        const wrap = document.createElement('div');
        wrap.className = 'dl-mobile-file-wrap';
        const btn = document.createElement('label');
        btn.className = 'dl-mobile-file-btn';
        const icon =
            role === 'video'
                ? 'fa-video'
                : role === 'selfie' || role === 'user'
                  ? 'fa-user-circle'
                  : 'fa-camera';
        const labelText =
            role === 'video'
                ? 'Grabar o elegir video'
                : role === 'selfie' || role === 'user'
                  ? 'Tomar selfie'
                  : 'Tomar foto o elegir archivo';

        btn.innerHTML = `<i class="fas ${icon}"></i><span class="dl-mobile-file-label">${labelText}</span>`;
        const nameEl = document.createElement('span');
        nameEl.className = 'dl-mobile-file-name';
        nameEl.textContent = '';

        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(btn);
        wrap.appendChild(nameEl);
        btn.appendChild(input);

        input.addEventListener('change', () => {
            handleFileChange(input, btn, nameEl);
        });
    }

    function initAll(root) {
        const scope = root || document;
        scope.querySelectorAll('input[type="file"][data-mobile-upload], input[type="file"][data-mobile-capture]').forEach(wrapFileInput);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initAll());
    } else {
        initAll();
    }

    return {
        MAX_IMAGE_BYTES,
        compressImageFile,
        replaceInputFile,
        wrapFileInput,
        initAll,
        isMobile
    };
})();
