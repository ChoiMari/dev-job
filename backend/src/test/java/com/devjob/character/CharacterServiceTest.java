package com.devjob.character;

import com.devjob.character.dto.EquipItemRequest;
import com.devjob.character.entity.CharacterEquipment;
import com.devjob.character.repository.CharacterEquipmentRepository;
import com.devjob.character.service.CharacterService;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CharacterServiceTest {
    private final CharacterEquipmentRepository equipment = mock(CharacterEquipmentRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CharacterService service = new CharacterService(equipment, users);

    @Test void initialStateAndCatalogUseRealAssetIds() {
        when(equipment.findById(1L)).thenReturn(Optional.empty());
        assertThat(service.state(1L).equippedItemId()).isEqualTo("BASE");
        assertThat(service.state(1L).equippedAssetId()).isEqualTo("EXT-IMG-06A");
        assertThat(service.state(1L).equipment()).containsEntry("HAIR", "CLASSIC").containsEntry("GLASSES", "NONE");
        assertThat(service.state(1L).layerAssetIds()).containsExactly(
                "B09-LAYER-HAIR-CLASSIC-BACK", "B09-LAYER-BODY", "B09-LAYER-OUTFIT-BASE",
                "B09-LAYER-HAIR-CLASSIC-FRONT");
        assertThat(service.items().subList(0, 3)).extracting("assetId")
                .containsExactly("EXT-IMG-06A", "EXT-IMG-06C", "EXT-IMG-06D");
        assertThat(service.items().subList(0, 3)).extracting("thumbnailAssetId")
                .containsExactly("EXT-IMG-06G", "EXT-IMG-06E", "EXT-IMG-06F");
        assertThat(service.items()).hasSize(9);
        assertThat(service.items().get(2).available()).isFalse();
        assertThat(service.items().get(2).availabilityCondition()).isEqualTo("FUTURE_REWARD");
    }

    @Test void rejectsLockedUnknownAndWrongSlotBeforeAnyWrite() {
        assertThatThrownBy(() -> service.equip(1L, "OUTFIT", new EquipItemRequest("PEACH")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        assertThatThrownBy(() -> service.equip(1L, "OUTFIT", new EquipItemRequest("UNKNOWN")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
        assertThatThrownBy(() -> service.equip(1L, "HAT", new EquipItemRequest("MINT")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
        verifyNoInteractions(users);
        verify(equipment, never()).saveAndFlush(any());
    }

    @Test void sameItemRetryAndUnequipKeepOneOwnerRow() {
        var owner = mock(User.class);
        when(users.findByIdForUpdate(1L)).thenReturn(Optional.of(owner));
        var row = new CharacterEquipment(1L, "MINT");
        when(equipment.findById(1L)).thenReturn(Optional.of(row));
        assertThat(service.equip(1L, "OUTFIT", new EquipItemRequest("MINT")).equippedItemId()).isEqualTo("MINT");
        assertThat(service.equip(1L, "OUTFIT", new EquipItemRequest(null)).equippedItemId()).isEqualTo("BASE");
        assertThat(row.getOutfitItemId()).isEqualTo("BASE");
        verify(equipment, never()).saveAndFlush(any());
        verify(users, times(2)).findByIdForUpdate(1L);
    }
    @Test void changingHairOrGlassesKeepsOtherSlotsAndLayerOrder() {
        var owner = mock(User.class);
        when(users.findByIdForUpdate(1L)).thenReturn(Optional.of(owner));
        var row = new CharacterEquipment(1L, "MINT");
        when(equipment.findById(1L)).thenReturn(Optional.of(row));
        var hair = service.equip(1L, "HAIR", new EquipItemRequest("PONY"));
        assertThat(hair.equipment()).containsEntry("OUTFIT", "MINT").containsEntry("HAIR", "PONY");
        var glasses = service.equip(1L, "GLASSES", new EquipItemRequest("ROUND"));
        assertThat(glasses.layerAssetIds()).containsExactly(
                "B09-LAYER-HAIR-PONY-BACK", "B09-LAYER-BODY", "B09-LAYER-OUTFIT-MINT",
                "B09-LAYER-HAIR-PONY-FRONT", "B09-LAYER-GLASSES-ROUND");
        assertThat(service.equip(1L, "GLASSES", new EquipItemRequest(null)).equipment())
                .containsEntry("GLASSES", "NONE");
    }
}
