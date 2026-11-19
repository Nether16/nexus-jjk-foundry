/** Save Nexus rich text after typing pauses, using the native editor lifecycle. */
export function registerRichTextAutosave() {
  Hooks.on("createProseMirrorEditor", (_uuid, plugins) => {
    plugins.nexusAutosave = new foundry.prosemirror.Plugin({
      view(view) {
        const editor = view.dom.closest("prose-mirror[data-nexus-editor]");
        if (!editor) return {};

        let timer;
        return {
          update(view, previousState) {
            if (view.state.doc.eq(previousState.doc)) return;

            clearTimeout(timer);
            timer = setTimeout(() => {
              timer = undefined;
              if (editor.isConnected && !editor.disabled) editor.save();
            }, 300);
          },
          destroy() {
            clearTimeout(timer);
          }
        };
      }
    });
  });
}
