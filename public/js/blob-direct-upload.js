/**
 * Subida directa del navegador a Vercel Blob (sin pasar por el límite ~4.5 MB de la función).
 * No usa imports externos: pide un token a nuestro server y hace PUT a la API de Blob.
 */
(function (global) {
    const BLOB_API_URL = 'https://vercel.com/api/blob';
    const BLOB_API_VERSION = '12';

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

    function putWithProgress(url, file, headers, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', url);
            Object.keys(headers).forEach((key) => {
                xhr.setRequestHeader(key, headers[key]);
            });
            xhr.upload.onprogress = (event) => {
                if (!event.lengthComputable || typeof onProgress !== 'function') return;
                onProgress({
                    phase: 'upload',
                    progress: Math.min(1, event.loaded / Math.max(event.total, 1)),
                    loaded: event.loaded,
                    total: event.total
                });
            };
            xhr.onload = () => {
                let data = {};
                try {
                    data = JSON.parse(xhr.responseText || '{}');
                } catch (_) {
                    data = {};
                }
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(data);
                    return;
                }
                reject(new Error(data.error || data.message || `Error al subir video (${xhr.status})`));
            };
            xhr.onerror = () => reject(new Error('Error de red al subir el video'));
            xhr.send(file);
        });
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

        const folder = String(options.folder || 'uploads/client').replace(/^\/+|\/+$/g, '');
        const pathname = `${folder}/${Date.now()}-${sanitizeName(file.name || 'video.mp4')}`;

        const tokenRes = await fetch(`${apiBase()}/api/blob/client-token`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${options.authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pathname })
        });
        const tokenData = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok) {
            throw new Error(tokenData.error || tokenData.message || 'No se pudo autorizar la subida del video');
        }

        const putUrl = `${tokenData.apiUrl || BLOB_API_URL}/?pathname=${encodeURIComponent(pathname)}`;
        const access = tokenData.access || 'private';
        const result = await putWithProgress(
            putUrl,
            file,
            {
                Authorization: `Bearer ${tokenData.clientToken}`,
                'x-api-version': String(tokenData.apiVersion || BLOB_API_VERSION),
                'x-vercel-blob-access': access,
                'x-content-type': file.type || 'video/mp4'
            },
            options.onProgress
        );

        const storedUrl = toStoredMediaUrl({
            pathname: result.pathname || pathname,
            url: result.url
        });
        if (!storedUrl) {
            throw new Error('La subida no devolvió URL del video');
        }

        return {
            url: storedUrl,
            pathname: result.pathname || pathname,
            downloadUrl: result.downloadUrl || result.url,
            size: file.size
        };
    }

    global.DeseoBlobUpload = {
        uploadFile,
        toStoredMediaUrl,
        isReady: true
    };
})(window);
