let isTransitioning = false;

function startTransition(callback, duration = 1000) {
    if (isTransitioning) return;
    isTransitioning = true;

    const overlay = document.querySelector('.transition-overlay');
    
    overlay.classList.add('active');
    document.body.classList.add('transitioning');

    setTimeout(() => {
        if (callback) callback();
        setTimeout(() => {
            overlay.classList.remove('active');
            document.body.classList.remove('transitioning');
            isTransitioning = false;
        }, duration);
    }, duration);
}

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.createElement('div');
    overlay.className = 'transition-overlay';
    
    const loader = document.createElement('div');
    loader.className = 'loader';

    const blobs = document.createElement('div');
    blobs.className = 'blobs';

    const blobCenter = document.createElement('div');
    blobCenter.className = 'blob-center';
    blobs.appendChild(blobCenter);

    for (let i = 0; i < 5; i++) {
        const blob = document.createElement('div');
        blob.className = 'blob';
        blobs.appendChild(blob);
    }
    
    loader.appendChild(blobs);
    overlay.appendChild(loader);

    document.body.appendChild(overlay);

    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            if (
                link.hostname === window.location.hostname && 
                !link.href.includes('#') &&
                !link.target
            ) {
                e.preventDefault();
                const targetUrl = link.href;

                startTransition(() => {
                    window.location.href = targetUrl;
                });
            }
        });
    });

    window.addEventListener('popstate', (event) => {
        startTransition(null, 1000);
    });
});

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        startTransition(null, 1000);
    } else {
        const overlay = document.querySelector('.transition-overlay');
        if (overlay) {
            overlay.classList.add('active');
            setTimeout(() => {
                overlay.classList.remove('active');
                document.body.classList.remove('transitioning');
            }, 1000);
        }
    }
});