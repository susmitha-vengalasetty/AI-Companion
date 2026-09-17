import * as materialService from '../services/materialService.js';

export const getProjectMaterials = async (req, res) => {
  try {
    const materials = await materialService.getProjectMaterials(req.params.projectId, req.user._id);
    res.status(200).json({ success: true, count: materials.length, data: materials });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadMaterial = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select a valid PDF file to upload.' });
    }

    const material = await materialService.createMaterialAndQueueJob({
      userId: req.user._id,
      projectId: req.params.projectId,
      file: req.file,
    });

    res.status(201).json({
      success: true,
      message: 'PDF material uploaded successfully. Asynchronous extraction queued.',
      data: material,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMaterial = async (req, res) => {
  try {
    const data = await materialService.getMaterialById(req.params.materialId, req.user._id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

export const getMaterialStatus = async (req, res) => {
  try {
    const data = await materialService.getMaterialById(req.params.materialId, req.user._id);
    res.status(200).json({
      success: true,
      data: {
        id: data.material._id,
        status: data.material.status,
        pageCount: data.material.pageCount,
        chunkCount: data.material.chunkCount,
        failureReason: data.material.failureReason,
        updatedAt: data.material.updatedAt,
      },
    });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

export const deleteMaterial = async (req, res) => {
  try {
    const result = await materialService.deleteMaterial(req.params.materialId, req.user._id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const retryMaterial = async (req, res) => {
  try {
    const material = await materialService.retryMaterialProcessing(req.params.materialId, req.user._id);
    res.status(200).json({
      success: true,
      message: 'Processing job re-queued.',
      data: material,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
