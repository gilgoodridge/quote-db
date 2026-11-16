package org.gilgood.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AiLookupRequest(@NotNull Type type, @NotNull @Valid Context context) {
    public enum Type {
        AUTHOR_DATE_OF_BIRTH, AUTHOR_DATE_OF_DEATH, AUTHOR_PLACE_OF_BIRTH, AUTHOR_BIOGRAPHY;

        @JsonCreator
        public static Type fromValue(String value) {
            return Type.valueOf(value);
        }
    }

    public record Context(@NotBlank @Size(max = 255) String fullName) {
    }
}
