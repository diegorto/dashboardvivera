import pandas as pd
from fuzzywuzzy import fuzz
from datetime import datetime
from src.core.logger import setup_logger

logger = setup_logger(__name__)

class ComparisonEngine:
    """Motor de comparação entre Clairis e Pipedrive"""
    
    def __init__(self):
        self.fuzzy_threshold = 85
        
    def match_patients(self, clairis_df: pd.DataFrame, pipedrive_df: pd.DataFrame) -> dict:
        """
        Compara pacientes usando estratégia de matching em cascata:
        1. ID Clairis
        2. Telefone (PRINCIPAL)
        3. CPF
        4. E-mail
        5. Nome + Data de nascimento
        6. Fuzzy Match
        """
        logger.info(f"Comparando {len(clairis_df)} pacientes Clairis com {len(pipedrive_df)} Pipedrive...")
        
        matches = []
        unmatched_clairis = []
        unmatched_pipedrive = pipedrive_df.copy()
        
        for idx, clairis_row in clairis_df.iterrows():
            match = self._find_best_match(clairis_row, pipedrive_df)
            
            if match:
                matches.append({
                    "clairis_id": clairis_row.get("clairis_id"),
                    "pipedrive_id": match.get("pipedrive_id"),
                    "clairis_data": clairis_row.to_dict(),
                    "pipedrive_data": match,
                    "match_score": match.get("match_score"),
                    "match_method": match.get("match_method"),
                    "differences": self._find_differences(clairis_row, match)
                })
                # Remove from unmatched
                unmatched_pipedrive = unmatched_pipedrive[
                    unmatched_pipedrive.get("pipedrive_id") != match.get("pipedrive_id")
                ]
            else:
                unmatched_clairis.append(clairis_row.to_dict())
        
        return {
            "timestamp": datetime.now().isoformat(),
            "total_clairis": len(clairis_df),
            "total_pipedrive": len(pipedrive_df),
            "matches": matches,
            "unmatched_clairis": unmatched_clairis,
            "unmatched_pipedrive": unmatched_pipedrive.to_dict('records'),
            "match_rate": len(matches) / len(clairis_df) * 100 if len(clairis_df) > 0 else 0
        }
    
    def _find_best_match(self, clairis_row: pd.Series, pipedrive_df: pd.DataFrame) -> dict:
        """Encontra o melhor match usando cascata de estratégias"""
        
        # Strategy 1: Clairis ID (if exists)
        if "clairis_id" in clairis_row and clairis_row["clairis_id"]:
            match = pipedrive_df[
                pipedrive_df.get("clairis_id") == clairis_row["clairis_id"]
            ]
            if not match.empty:
                result = match.iloc[0].to_dict()
                result["match_score"] = 100
                result["match_method"] = "clairis_id"
                return result
        
        # Strategy 2: Telefone (PRINCIPAL - never allow duplicates with same phone)
        if "telefone_normalizado" in clairis_row and clairis_row["telefone_normalizado"]:
            matches = pipedrive_df[
                pipedrive_df.get("telefone_normalizado") == clairis_row["telefone_normalizado"]
            ]
            if not matches.empty:
                # If multiple matches with same phone, return best match
                result = matches.iloc[0].to_dict()
                result["match_score"] = 100
                result["match_method"] = "phone"
                return result
        
        # Strategy 3: CPF
        if "cpf_normalizado" in clairis_row and clairis_row["cpf_normalizado"]:
            match = pipedrive_df[
                pipedrive_df.get("cpf_normalizado") == clairis_row["cpf_normalizado"]
            ]
            if not match.empty:
                result = match.iloc[0].to_dict()
                result["match_score"] = 95
                result["match_method"] = "cpf"
                return result
        
        # Strategy 4: Email
        if "email" in clairis_row and clairis_row["email"]:
            match = pipedrive_df[
                pipedrive_df.get("email", "").str.lower() == clairis_row["email"].lower()
            ]
            if not match.empty:
                result = match.iloc[0].to_dict()
                result["match_score"] = 90
                result["match_method"] = "email"
                return result
        
        # Strategy 5: Nome + Data de nascimento
        if "nome_normalizado" in clairis_row and "birth_date" in clairis_row:
            match = pipedrive_df[
                (pipedrive_df.get("nome_normalizado") == clairis_row["nome_normalizado"]) &
                (pipedrive_df.get("birth_date") == clairis_row["birth_date"])
            ]
            if not match.empty:
                result = match.iloc[0].to_dict()
                result["match_score"] = 85
                result["match_method"] = "name_birthdate"
                return result
        
        # Strategy 6: Fuzzy Match (name similarity)
        if "nome_normalizado" in clairis_row and clairis_row["nome_normalizado"]:
            best_score = 0
            best_match = None
            
            for idx, pv_row in pipedrive_df.iterrows():
                if "nome_normalizado" in pv_row and pv_row["nome_normalizado"]:
                    score = fuzz.ratio(
                        clairis_row["nome_normalizado"].lower(),
                        pv_row["nome_normalizado"].lower()
                    )
                    
                    if score > best_score and score >= self.fuzzy_threshold:
                        best_score = score
                        best_match = pv_row.to_dict()
            
            if best_match:
                best_match["match_score"] = best_score
                best_match["match_method"] = "fuzzy_match"
                return best_match
        
        return None
    
    def _find_differences(self, clairis_row: pd.Series, pipedrive_row: dict) -> list:
        """Encontra diferenças entre os registros"""
        differences = []
        
        # Fields to compare
        compare_fields = [
            ("nome_normalizado", "nome_normalizado"),
            ("telefone_normalizado", "telefone_normalizado"),
            ("email", "email"),
            ("cpf_normalizado", "cpf_normalizado"),
            ("status_normalizado", "status_normalizado"),
        ]
        
        for clairis_field, pipedrive_field in compare_fields:
            if clairis_field in clairis_row and pipedrive_field in pipedrive_row:
                clairis_value = clairis_row[clairis_field]
                pipedrive_value = pipedrive_row.get(pipedrive_field)
                
                if str(clairis_value) != str(pipedrive_value):
                    differences.append({
                        "field": clairis_field,
                        "clairis_value": clairis_value,
                        "pipedrive_value": pipedrive_value
                    })
        
        return differences
