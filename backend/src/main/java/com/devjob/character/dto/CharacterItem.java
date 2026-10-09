package com.devjob.character.dto;

import java.util.List;

public record CharacterItem(String id, String slot, String name, String thumbnailAssetId, String assetId,
        List<String> layerAssetIds, boolean available, String availabilityCondition) { }
