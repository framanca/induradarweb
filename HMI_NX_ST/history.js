/* Undo/redo for the HMI NX ST editor. Keeps snapshots independent of autosave. */
(function(root){
'use strict';
function create(limit=100){
  const max=Math.max(1,Math.min(500,Number(limit)||100));
  const undoStack=[],redoStack=[];
  function capture(project,screenId,selected){
    return {project:JSON.stringify(project),screenId,selected:selected||null};
  }
  function commit(previous,project){
    if(!previous||typeof previous.project!=='string')throw new TypeError('Invalid editor history snapshot');
    if(previous.project===JSON.stringify(project))return false;
    undoStack.push(previous);
    if(undoStack.length>max)undoStack.shift();
    redoStack.length=0;
    return true;
  }
  function undo(current){
    if(!undoStack.length)return null;
    redoStack.push(current);
    return undoStack.pop();
  }
  function redo(current){
    if(!redoStack.length)return null;
    undoStack.push(current);
    if(undoStack.length>max)undoStack.shift();
    return redoStack.pop();
  }
  function clear(){undoStack.length=0;redoStack.length=0;}
  return {capture,commit,undo,redo,clear,get canUndo(){return undoStack.length>0},get canRedo(){return redoStack.length>0}};
}
const api={create};
root.NXEditorHistory=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
