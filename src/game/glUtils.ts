let cachedSoftwareGl: boolean | null = null;

/**
 * Detects software WebGL renderers once and caches the result to avoid
 * repeatedly creating and losing WebGL contexts across screen transitions.
 */
export function isSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = true;
      return cachedSoftwareGl;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Mesa OffScreen|Paravirtual/i.test(gpu);
    return cachedSoftwareGl;
  } catch {
    cachedSoftwareGl = true;
    return true;
  }
}

export function scheduleSoftwareGlFrame(
  gl: WebGLRenderingContext | WebGL2RenderingContext | null | undefined,
  isDisposed: () => boolean,
  registerTimer: (id: number) => void,
  onReady: () => void,
): void {
  if (isDisposed()) return;

  if (
    !gl ||
    gl.isContextLost() ||
    typeof (gl as WebGL2RenderingContext).fenceSync !== 'function'
  ) {
    registerTimer(window.setTimeout(onReady, 80));
    return;
  }

  try {
    const gl2 = gl as WebGL2RenderingContext;
    const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl2.flush();
    if (!sync) {
      registerTimer(window.setTimeout(onReady, 80));
      return;
    }

    let polls = 0;
    const poll = () => {
      if (isDisposed()) {
        try {
          gl2.deleteSync(sync);
        } catch {
          // ignore
        }
        return;
      }
      polls += 1;
      const state = gl2.getSyncParameter(sync, gl2.SYNC_STATUS);
      if (state === gl2.UNSIGNALED && polls < 40) {
        registerTimer(window.setTimeout(poll, 5));
      } else {
        try {
          gl2.deleteSync(sync);
        } catch {
          // ignore
        }
        registerTimer(window.setTimeout(onReady, 80));
      }
    };
    registerTimer(window.setTimeout(poll, 5));
  } catch {
    registerTimer(window.setTimeout(onReady, 80));
  }
}
