/**
 * Subida directa del navegador a Vercel Blob (sin pasar por el límite ~4.5 MB de la función).
 */
(function (global) {
    let uploadModulePromise = null;

    function apiBase() {
        if (typeof API_URL === 'string' && API_URL) {
            return API_URL.replace(/\/$/, '');
        }
        return '';
    }

    function sanitizeName(name) {
        return String(name || 'video.mp4')
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .slice(0, 80);
    }

    function toStoredMediaUrl(blob) {
        const pathname = String(blob?.pathname || '').replace(/^\/+/, '');
        if (pathname.startsWith('uploads/')) {
            const encoded = pathname.split('/').map((p) => encodeURIComponent(p)).join('/');
            return `/api/media/${encoded}`;
        }
        return blob?.url || '';
    }

    async function loadUploadFn() {
        if (!uploadModulePromise) {
            uploadModulePromise = import('https://esm.sh/@vercel/blob@2.4.0/client')
                .then((mod) => mod.upload || mod.default?.upload)
                .catch((err) => {
                    uploadModulePromise = null;
                    throw new Error(
                        'No se pudo cargar el uploader de video. Revisá la conexión e intentá de nuevo.'
                    );
                });
        }
        const upload = await uploadModulePromise;
        if (typeof upload !== 'function') {
            throw new Error('Uploader de video no disponible en este navegador');
        }
        return upload;
    }

    /**
     * @param {File|Blob} file
     * @param {{ authToken: string, folder?: string, onProgress?: Function }} options
     */
    async function uploadFile(file, options = {}) {
        if (!file) {
            throw new Error('No hay archivo para subir');
        }
        if (!options.authToken) {
            throw new Error('Sesión requerida para subir');
        }

        const upload = await loadUploadFn();
        const folder = String(options.folder || 'uploads/client').replace(/^\/+|\/+$/g, '');
        const pathname = `${folder}/${Date.now()}-${sanitizeName(file.name || 'video.mp4')}`;
        const handleUploadUrl = `${apiBase()}/api/blob/client-upload`;

        const result = await upload(pathname, file, {
            access: 'private',
            handleUploadUrl,
            headers: {
                Authorization: `Bearer ${options.authToken}`
            },
            multipart: true,
            contentType: file.type || 'application/octet-stream',
            onUploadProgress: (event) => {
                if (typeof options.onProgress === 'function') {
                    options.onProgress({
                        phase: 'upload',
                        progress: Math.min(1, (event?.percentage || 0) / 100),
                        loaded: event?.loaded,
                        total: event?.total
                    });
                }
            }
        });

        const storedUrl = toStoredMediaUrl(result);
        if (!storedUrl) {
            throw new Error('La subida no devolvió URL del video');
        }

        return {
            url: storedUrl,
            pathname: result.pathname,
            downloadUrl: result.downloadUrl || result.url,
            size: file.size
        };
    }

    global.DeseoBlobUpload = {
        uploadFile,
        toStoredMediaUrl
    };
})(window);
