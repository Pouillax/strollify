import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, Radii, Shadows } from '@/constants/theme';
import {
  AutocompleteSuggestion,
  getAddressSuggestions,
  getPlaceCoordinates,
} from '@/services/google-maps';
import { Coordinates } from '@/types';

interface AddressInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectPlace: (address: string, coords: Coordinates) => void;
  placeholder?: string;
}

export default function AddressInput({
  value,
  onChangeText,
  onSelectPlace,
  placeholder,
}: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((text: string) => {
    onChangeText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await getAddressSuggestions(text);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [onChangeText]);

  const handleSelect = useCallback(async (suggestion: AutocompleteSuggestion) => {
    setSuggestions([]);
    onChangeText(suggestion.description);
    const coords = await getPlaceCoordinates(suggestion.placeId);
    if (coords) onSelectPlace(suggestion.description, coords);
  }, [onChangeText, onSelectPlace]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          onBlur={() => setTimeout(() => setSuggestions([]), 150)}
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color={Colors.primary}
            style={styles.spinner}
          />
        )}
      </View>

      {suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((s, i) => (
            <Pressable
              key={s.placeId}
              style={[styles.suggestion, i < suggestions.length - 1 && styles.suggestionBorder]}
              onPress={() => handleSelect(s)}
            >
              <Text style={styles.mainText} numberOfLines={1}>{s.mainText}</Text>
              {s.secondaryText ? (
                <Text style={styles.secondaryText} numberOfLines={1}>{s.secondaryText}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 10 },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
  },
  spinner: { paddingRight: 12 },

  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: Colors.card,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.md,
    zIndex: 20,
  },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  mainText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  secondaryText: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
