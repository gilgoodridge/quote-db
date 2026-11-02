package org.gilgood.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "tones")
public class Tone extends QuoteCategory {
}
