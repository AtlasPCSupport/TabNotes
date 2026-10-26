type FloatingAction =
  | 'new-note'
  | 'screenshot-current'
  | 'screenshot-new'
  | 'crop-current'
  | 'crop-new'
  | 'clip-current'
  | 'clip-new';

const ROOT_ID = 'tabnotes-floating-button';

const copy = (key: string, fallback: string) => chrome.i18n.getMessage(key) || fallback;

if (window.top === window && !document.getElementById(ROOT_ID)) {
  const host = document.createElement('div');
  host.id = ROOT_ID;
  host.setAttribute('aria-label', copy('floatingLabel', 'TabNotes capture'));
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .root { position: fixed; right: 16px; bottom: 16px; z-index: 2147483646; font-family: system-ui, sans-serif; color: #fff; }
    .menu { display: grid; gap: 4px; width: 220px; margin: 0 0 8px auto; padding: 6px; border: 1px solid rgba(255,255,255,.2); border-radius: 12px; background: #1d1e22; box-shadow: 0 8px 28px rgba(0,0,0,.35); }
    .menu[hidden] { display: none; }
    button { font: 600 12px/1.25 system-ui, sans-serif; color: #fff; cursor: pointer; }
    .item { width: 100%; padding: 9px 10px; border: 0; border-radius: 8px; background: transparent; text-align: left; }
    .item:hover, .item:focus-visible { background: #2d2e34; outline: 0; }
    .trigger { display: grid; place-items: center; width: 42px; height: 42px; margin-left: auto; padding: 0; border: 1px solid rgba(255,255,255,.3); border-radius: 50%; background: #dcae19; color: #15130a; box-shadow: 0 4px 16px rgba(0,0,0,.28); font-size: 20px; }
    .trigger:hover, .trigger:focus-visible { background: #f2c735; outline: 3px solid rgba(220,174,25,.35); outline-offset: 2px; }
    .trigger svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  `;
  shadow.append(style);

  const root = document.createElement('div');
  root.className = 'root';

  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', copy('floatingLabel', 'TabNotes capture'));
  menu.hidden = true;

  const trigger = document.createElement('button');
  trigger.className = 'trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', copy('floatingLabel', 'TabNotes capture'));

  const setTriggerIcon = (open: boolean) => {
    trigger.replaceChildren();
    if (open) {
      trigger.textContent = '×';
      return;
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 5v14M5 12h14');
    svg.append(path);
    trigger.append(svg);
  };

  const actions: Array<{ action: FloatingAction; label: string }> = [
    { action: 'new-note', label: copy('floatingNewNote', 'New note') },
    {
      action: 'screenshot-current',
      label: copy('floatingScreenshotCurrent', 'Screenshot → current note'),
    },
    { action: 'screenshot-new', label: copy('floatingScreenshotNew', 'Screenshot → new note') },
    { action: 'crop-current', label: copy('floatingCropCurrent', 'Crop → current note') },
    { action: 'crop-new', label: copy('floatingCropNew', 'Crop → new note') },
    { action: 'clip-current', label: copy('floatingClipCurrent', 'Clip → current note') },
    { action: 'clip-new', label: copy('floatingClipNew', 'Clip → new note') },
  ];

  const setOpen = (open: boolean) => {
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    setTriggerIcon(open);
  };

  setTriggerIcon(false);

  actions.forEach(({ action, label }) => {
    const item = document.createElement('button');
    item.className = 'item';
    item.type = 'button';
    item.role = 'menuitem';
    item.textContent = label;
    item.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'FLOATING_ACTION', action });
      setOpen(false);
    });
    menu.append(item);
  });

  trigger.addEventListener('click', () => setOpen(menu.hidden));
  document.addEventListener('click', (event) => {
    if (!host.contains(event.target as Node)) setOpen(false);
  });

  shadow.append(root);
  root.append(menu, trigger);
  document.documentElement.append(host);

  chrome.runtime.onMessage.addListener((message: { type?: unknown; enabled?: unknown }) => {
    if (message?.type === 'FLOATING_SET_ENABLED' && message.enabled === false) host.remove();
  });
}
