package org.gilgood.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "forms")
public class Form extends QuoteCategory {
}
