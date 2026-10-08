package com.devjob.character.dto;

import java.util.List;
import java.util.Map;

public record CharacterState(String baseAssetId, String slot, String equippedItemId,
        String equippedAssetId, Map<String, String> equipment, List<String> layerAssetIds) { }
