import { useState, useCallback } from "react";
import { editFormUnchanged } from "../lib/utils";

/** Edición inline con detección de cambios (open / close / guard). */
export function useInlineEdit() {
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [editOriginal, setEditOriginal] = useState(null);

  const openEdit = useCallback((id, snapshot) => {
    setEditId(id);
    setEditData(snapshot);
    setEditOriginal(snapshot);
  }, []);

  const closeEdit = useCallback(() => {
    setEditId(null);
    setEditData({});
    setEditOriginal(null);
  }, []);

  const isEditUnchanged = useCallback(
    (keys) => (editOriginal ? editFormUnchanged(editOriginal, editData, keys) : true),
    [editOriginal, editData]
  );

  const guardEditSave = useCallback(
    (keys, showToast) => {
      if (editFormUnchanged(editOriginal, editData, keys)) {
        showToast("No hay cambios para guardar.", "info");
        return false;
      }
      return true;
    },
    [editOriginal, editData]
  );

  return {
    editId,
    editData,
    setEditData,
    editOriginal,
    openEdit,
    closeEdit,
    isEditUnchanged,
    guardEditSave,
  };
}
